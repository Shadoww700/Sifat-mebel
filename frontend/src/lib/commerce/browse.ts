import { Product, productPrice } from "./models";
import { attributeLabel, attributeToken } from "./catalog-attributes";
import { resolvedAttributes } from "./variants";

export type BrowseFilters = {
  query: string;
  category: string;
  type: string;
  brand: string;
  available: boolean;
  min: string;
  max: string;
  sort: string;
  attributes: Record<string, string>;
};
export const emptyFilters: BrowseFilters = {
  query: "",
  category: "",
  type: "",
  brand: "",
  available: false,
  min: "",
  max: "",
  sort: "featured",
  attributes: {},
};
export function filterProducts(products: Product[], filters: BrowseFilters) {
  const query = filters.query.trim().toLocaleLowerCase("ru");
  const result = products.filter(
    (p) =>
      (!query ||
        `${p.name} ${p.brand} ${p.sku} ${p.description} ${p.productType.name} ${p.attributes.map(attributeLabel).join(" ")} ${p.variants.map((v) => `${v.name} ${v.sku ?? ""} ${v.attributes.map(attributeLabel).join(" ")}`).join(" ")}`
          .toLocaleLowerCase("ru")
          .includes(query)) &&
      (!filters.category || p.productType.categoryId === filters.category) &&
      (!filters.type || p.productType.id === filters.type) &&
      (!filters.brand || p.brand === filters.brand) &&
      // Attribute, price and availability constraints must match ONE concrete SKU.
      (p.variants.length ? p.variants : [undefined]).some(
        (variant) =>
          Object.entries(filters.attributes).every(([id, value]) =>
            resolvedAttributes(p, variant).some(
              (attribute) =>
                attribute.id === id &&
                attribute.filterable &&
                attributeToken(attribute.value) === value,
            ),
          ) &&
          (!filters.available ||
            (p.available && (variant?.stock ?? p.stock ?? 0) > 0)) &&
          (!filters.min || productPrice(p, variant) >= Number(filters.min)) &&
          (!filters.max || productPrice(p, variant) <= Number(filters.max)),
      ),
  );
  if (filters.sort === "price-asc")
    result.sort((a, b) => productPrice(a) - productPrice(b));
  if (filters.sort === "price-desc")
    result.sort((a, b) => productPrice(b) - productPrice(a));
  if (filters.sort === "name")
    result.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return result;
}

export function attributeFacets(
  products: Product[],
  filters: Pick<BrowseFilters, "category" | "type">,
) {
  const facets = new Map<
    string,
    {
      id: string;
      name: string;
      options: {
        value: string;
        label: string;
        raw: string | number | boolean;
      }[];
    }
  >();
  for (const product of products) {
    if (
      (filters.category &&
        product.productType.categoryId !== filters.category) ||
      (filters.type && product.productType.id !== filters.type)
    )
      continue;
    for (const attribute of [
      ...product.attributes,
      ...product.variants.flatMap((v) => v.attributes),
    ]) {
      if (!attribute.filterable) continue;
      const facet = facets.get(attribute.id) ?? {
        id: attribute.id,
        name: attribute.name,
        options: [],
      };
      const value = attributeToken(attribute.value);
      if (!facet.options.some((option) => option.value === value))
        facet.options.push({
          value,
          label: attributeLabel(attribute),
          raw: attribute.value,
        });
      facets.set(attribute.id, facet);
    }
  }
  return Array.from(facets.values()).map((facet) => ({
    ...facet,
    options: facet.options.sort((a, b) =>
      typeof a.raw === "number" && typeof b.raw === "number"
        ? a.raw - b.raw
        : a.label.localeCompare(b.label, "ru"),
    ),
  }));
}
