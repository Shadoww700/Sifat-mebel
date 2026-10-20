import type { Catalog } from "./models";
import type {
  AttributeDTO,
  TypeAttributeDTO,
  AttributeValueDTO,
} from "./catalog-attributes";
import type {
  CategoryDTO,
  TypeDTO,
  ProductDTO,
  ImageDTO,
  VariantDTO,
  VariantValueDTO,
} from "./catalog-contracts";
import { mapCatalog } from "./catalog-mapper";

type Page<T> = T[] | { results: T[]; next: string | null };

/** GET only; paths verified against backend/catalog/urls.py. */
export async function loadApiCatalog(): Promise<Catalog> {
  const origin = process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000";
  async function list<T>(path: string): Promise<T[]> {
    let url: URL | null = new URL(`/api/v1/catalog/${path}`, origin);
    const result: T[] = [];
    const visited = new Set<string>();
    while (url) {
      if (url.origin !== new URL(origin).origin || visited.has(url.href))
        throw new Error("Invalid catalog pagination");
      visited.add(url.href);
      const response: Response = await fetch(url, {
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok)
        throw new Error(`Catalog API returned ${response.status}`);
      const data: Page<T> = await response.json();
      result.push(...(Array.isArray(data) ? data : data.results));
      url = !Array.isArray(data) && data.next ? new URL(data.next, url) : null;
    }
    return result;
  }
  const issues: NonNullable<Catalog["issues"]> = [];
  const imagesRequest = list<ImageDTO>("product-image").catch(() => {
    issues.push({
      scope: "images",
      message: "Фотографии временно недоступны. Попробуйте обновить каталог.",
    });
    return [];
  });
  const attributesRequest = Promise.all([
    list<AttributeDTO>("attributes/"),
    list<TypeAttributeDTO>("product-type-attributes/"),
    list<AttributeValueDTO>("product-attribute-values/"),
  ])
    .then(([definitions, links, values]) => ({ definitions, links, values }))
    .catch(() => {
      issues.push({
        scope: "attributes",
        message: "Характеристики и фильтры по ним временно недоступны.",
      });
      return null;
    });
  const variantsRequest = Promise.all([
    list<VariantDTO>("product-variants/"),
    list<VariantValueDTO>("variant-attribute-values/"),
  ]).catch(() => {
    issues.push({
      scope: "variants",
      message:
        "Варианты и их наличие временно недоступны. Уточните исполнение и цену у менеджера.",
    });
    return [[], []] as [VariantDTO[], VariantValueDTO[]];
  });
  const [
    products,
    categories,
    types,
    images,
    attributes,
    [variants, variantValues],
  ] = await Promise.all([
    list<ProductDTO>("products/"),
    list<CategoryDTO>("categories/"),
    list<TypeDTO>("product-types/"),
    imagesRequest,
    attributesRequest,
    variantsRequest,
  ]);
  return {
    ...mapCatalog(
      {
        products,
        categories,
        types,
        images,
        attributes,
        variants,
        variantValues,
      },
      "api",
      (path) => new URL(path, origin).href,
    ),
    issues: issues.sort((a, b) => a.scope.localeCompare(b.scope)),
  };
}
