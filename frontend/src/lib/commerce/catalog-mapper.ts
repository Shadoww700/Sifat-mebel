import type { Catalog, DataSource, Product, Variant } from "./models";
import type { CatalogData, TypeDTO } from "./catalog-contracts";
import { productAttributes } from "./catalog-attributes";

const productType = (t: TypeDTO) => ({
  id: String(t.id),
  name: t.name,
  slug: t.slug,
  categoryId: String(t.category),
});

/** One transformation for both fixture responses and real responses. */
export function mapCatalog(
  data: CatalogData,
  source: DataSource,
  media: (path: string) => string,
): Catalog {
  const categories = data.categories.filter((c) => c.is_active !== false);
  const categoryIds = new Set(categories.map((c) => c.id));
  const types = data.types.filter(
    (t) => t.is_active !== false && categoryIds.has(t.category),
  );
  const typeIds = new Set(types.map((t) => t.id));
  // Index once: images may still be a large unfiltered backend collection.
  const images = new Map<number, CatalogData["images"]>();
  for (const image of data.images) {
    const group = images.get(image.product) ?? [];
    group.push(image);
    images.set(image.product, group);
  }
  const variantsByProduct = new Map<number, CatalogData["variants"]>();
  for (const variant of data.variants) {
    if (!variant.is_active) continue;
    const group = variantsByProduct.get(variant.product) ?? [];
    group.push(variant);
    variantsByProduct.set(variant.product, group);
  }
  return {
    source,
    categories: categories.map((c) => ({
      id: String(c.id),
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image ? media(c.image) : "",
    })),
    types: types.map(productType),
    products: data.products
      .filter(
        (p) =>
          p.is_active !== false &&
          ["ACTIVE", "OUT_OF_STOCK"].includes(p.status) &&
          typeIds.has(p.product_type_info.id),
      )
      .map((p): Product => {
        const variants: Variant[] = (variantsByProduct.get(p.id) ?? []).map(
          (v) => ({
            id: String(v.id),
            name: v.name,
            sku: v.sku,
            price: Number(v.price),
            discountPrice:
              v.discount_price === null ? null : Number(v.discount_price),
            stock: v.stock_quantity,
            attributes: data.attributes
              ? productAttributes(v.id, p.product_type_info.id, {
                  ...data.attributes,
                  values: data.variantValues.map((row) => ({
                    ...row,
                    product: row.variant,
                  })),
                })
              : [],
          }),
        );
        const outOfStock = p.status === "OUT_OF_STOCK";
        const stock = outOfStock
          ? 0
          : variants.length
            ? variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
            : null;
        return {
          id: String(p.id),
          status: outOfStock ? "OUT_OF_STOCK" : "ACTIVE",
          name: p.name,
          slug: p.slug,
          brand: p.brand_info?.name ?? "",
          productType: productType(p.product_type_info),
          description: p.description || p.short_description,
          sku: p.sku,
          basePrice: Number(p.base_price),
          discountPrice:
            p.discount_price === null ? null : Number(p.discount_price),
          currency: p.currency,
          images: (images.get(p.id) ?? [])
            .sort(
              (a, b) =>
                Number(b.is_primary) - Number(a.is_primary) ||
                a.sort_order - b.sort_order,
            )
            .map((i) => ({ src: media(i.image), alt: i.alt_text || p.name })),
          available: !outOfStock && (stock === null || stock > 0),
          stock,
          variants,
          attributes: data.attributes
            ? productAttributes(p.id, p.product_type_info.id, data.attributes)
            : [],
          badge: p.is_featured ? "В коллекции" : undefined,
          warranty: p.warranty,
          country: p.country_of_origin,
          delivery: "Доставку, сроки и условия обсудим с вами в магазине.",
          source,
        };
      }),
  };
}
