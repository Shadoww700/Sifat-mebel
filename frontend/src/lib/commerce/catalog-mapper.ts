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
  const types = data.types.filter(
    (t) => t.is_active !== false && categories.some((c) => c.id === t.category),
  );
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
          p.status === "ACTIVE" &&
          types.some((t) => t.id === p.product_type_info.id),
      )
      .map((p): Product => {
        const variants: Variant[] = data.variants
          .filter((v) => v.product === p.id && v.is_active)
          .map((v) => ({
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
          }));
        const stock = variants.length
          ? variants.reduce((sum, v) => sum + (v.stock ?? 0), 0)
          : null;
        return {
          id: String(p.id),
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
          images: data.images
            .filter((i) => i.product === p.id)
            .sort(
              (a, b) =>
                Number(b.is_primary) - Number(a.is_primary) ||
                a.sort_order - b.sort_order,
            )
            .map((i) => ({ src: media(i.image), alt: i.alt_text || p.name })),
          available: stock === null || stock > 0,
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
