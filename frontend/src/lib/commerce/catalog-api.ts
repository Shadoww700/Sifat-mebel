import type { Catalog, Product } from "./models";
import type {
  CategoryDTO,
  TypeDTO,
  ProductDTO,
  ImageDTO,
} from "./catalog-contracts";
import { mapCatalog } from "./catalog-mapper";
import type { BrowseFilters } from "./browse";

export type CatalogRequest = {
  page?: number;
  pageSize?: number;
  filters?: BrowseFilters;
  includeBrands?: boolean;
};
export type ProductPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
const origin = () => process.env.DJANGO_API_ORIGIN ?? "http://127.0.0.1:8000";

export async function catalogGet<T>(path: string, fresh = false): Promise<T> {
  const response = await fetch(new URL(`/api/v1/catalog/${path}`, origin()), {
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 60 } }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new CatalogApiError(response.status);
  return response.json();
}
export class CatalogApiError extends Error {
  constructor(public status: number) {
    super(`Catalog API returned ${status}`);
  }
}
function array<T>(data: unknown): T[] {
  if (!Array.isArray(data))
    throw new Error("Некорректный список API: этот ресурс не имеет пагинации");
  return data;
}
export function readProductPage<T>(data: T[] | ProductPage<T>): ProductPage<T> {
  if (Array.isArray(data))
    return { results: data, count: data.length, next: null, previous: null };
  if (
    !data ||
    !Array.isArray(data.results) ||
    !Number.isSafeInteger(data.count) ||
    data.count < 0
  )
    throw new Error("Некорректная страница товаров API");
  return data;
}
export async function loadApiNavigation(): Promise<Catalog> {
  const [categories, types] = await Promise.all([
    catalogGet<CategoryDTO[]>("categories/"),
    catalogGet<TypeDTO[]>("product-types/"),
  ]);
  return mapCatalog(
    {
      products: [],
      categories: array(categories),
      types: array(types),
      images: [],
      attributes: null,
      variants: [],
      variantValues: [],
    },
    "api",
    (path) => new URL(path, origin()).href,
  );
}
export function productQuery({
  page = 1,
  pageSize = 20,
  filters,
}: CatalogRequest): URLSearchParams {
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (filters) {
    if (filters.query) query.set("search", filters.query);
    if (/^[1-9]\d*$/.test(filters.category))
      query.set("category_id", filters.category);
    if (/^[1-9]\d*$/.test(filters.brand)) query.set("brand_id", filters.brand);
    if (filters.min) query.set("min_price", filters.min);
    if (filters.max) query.set("max_price", filters.max);
    query.set(
      "ordering",
      (
        {
          "price-asc": "base_price",
          "price-desc": "-base_price",
          oldest: "created_at",
        } as Record<string, string>
      )[filters.sort] ?? "-created_at",
    );
  }
  return query;
}
/** Exactly ONE products request. next/previous are metadata, never URLs to crawl. */
export async function loadApiCatalog(
  options: CatalogRequest = {},
): Promise<Catalog> {
  const pageNumber = options.page ?? 1,
    pageSize = options.pageSize ?? 20;
  const issues: NonNullable<Catalog["issues"]> = [];
  const [categories, page, brands] = await Promise.all([
    catalogGet<CategoryDTO[]>("categories/").then(array<CategoryDTO>),
    catalogGet<ProductDTO[] | ProductPage<ProductDTO>>(
      `products/?${productQuery(options)}`,
      true,
    ).then(readProductPage),
    options.includeBrands === false
      ? Promise.resolve([])
      : catalogGet<{ id: number; name: string }[]>("brands/")
          .then(array<{ id: number; name: string }>)
          .catch(() => {
            issues.push({
              scope: "brands",
              message:
                "Список брендов временно недоступен. Фильтр можно обновить повторной загрузкой.",
            });
            return [];
          }),
  ]);
  // Request images only for this page; no global image scan or per-card GETs.
  // Fresh reads also respect products/parents that have just become hidden.
  const productIds = page.results.map((product) => product.id);
  const imageQuery = new URLSearchParams({ product_ids: productIds.join(",") });
  const images = productIds.length
    ? await catalogGet<ImageDTO[]>(
        `product-image?${imageQuery}`,
        true,
      )
        .then(array<ImageDTO>)
        .catch(() => {
          issues.push({
            scope: "images",
            message:
              "Фотографии временно недоступны. Попробуйте обновить каталог.",
          });
          return [];
        })
    : [];
  const catalog = mapCatalog(
    {
      products: page.results,
      categories,
      types: [
        ...new Map(
          page.results.map((p) => [
            p.product_type_info.id,
            p.product_type_info,
          ]),
        ).values(),
      ],
      images,
      attributes: null,
      variants: [],
      variantValues: [],
    },
    "api",
    (path) => new URL(path, origin()).href,
  );
  return {
    ...catalog,
    brands: brands.map((b) => ({ id: String(b.id), name: b.name })),
    issues,
    pagination: {
      page: pageNumber,
      pageSize,
      count: page.count,
      pages: Math.max(1, Math.ceil(page.count / pageSize)),
    },
  };
}

// Actual ProductDetailSerializer projections. No request for all variants/values.
type ValueDTO = {
  attribute_info: { id: number; name: string; unit: string; data_type: string };
  value_text: string | null;
  value_number: string | null;
  value_boolean: boolean | null;
};
export type DetailDTO = Omit<
  ProductDTO,
  "product_type" | "brand" | "is_active" | "is_featured"
> & {
  images: ImageDTO[];
  attribute_values: ValueDTO[];
  variants: {
    id: number;
    name: string;
    sku: string;
    price: string;
    discount_price: string | null;
    stock_quantity: number;
    attribute_values: ValueDTO[];
  }[];
};
function detailAttributes(
  values: ValueDTO[],
  variantOption = false,
): Product["attributes"] {
  return values.flatMap((row) => {
    const attr = row.attribute_info;
    const value =
      attr.data_type === "BOOLEAN"
        ? row.value_boolean
        : attr.data_type === "NUMBER"
          ? row.value_number === null
            ? null
            : Number(row.value_number)
          : row.value_text;
    return value == null ||
      (typeof value === "number" && !Number.isFinite(value))
      ? []
      : [
          {
            id: String(attr.id),
            name: attr.name,
            unit: attr.unit || undefined,
            value,
            variantOption,
          },
        ];
  });
}
export async function loadApiProduct(id: string): Promise<Product | null> {
  if (!/^[1-9]\d*$/.test(id)) return null;
  let dto: DetailDTO;
  try {
    dto = await catalogGet<DetailDTO>(`product/${id}/`, true);
  } catch (error) {
    if (error instanceof CatalogApiError && error.status === 404) return null;
    throw error;
  }
  const catalog = mapCatalog(
    {
      products: [
        {
          ...dto,
          product_type: dto.product_type_info.id,
          brand: dto.brand_info?.id ?? null,
          is_active: true,
          is_featured: false,
        },
      ],
      categories: [dto.product_type_info.category_info],
      types: [dto.product_type_info],
      images: dto.images,
      variants: dto.variants.map((v) => ({
        ...v,
        product: dto.id,
        is_active: true,
      })),
      attributes: null,
      variantValues: [],
    },
    "api",
    (path) => new URL(path, origin()).href,
  );
  const product = catalog.products[0];
  if (!product) return null;
  product.attributes = detailAttributes(dto.attribute_values);
  product.variants.forEach((v) => {
    v.attributes = detailAttributes(
      dto.variants.find((row) => String(row.id) === v.id)!.attribute_values,
      true,
    );
  });
  return product;
}
