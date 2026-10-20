import type { Attribute, Product, Variant } from "@/lib/commerce/models";
import { money, productPrice } from "@/lib/commerce/models";
import { attributeLabel } from "@/lib/commerce/catalog-attributes";

export function AttributeDisplay({ attributes }: { attributes: Attribute[] }) {
  return (
    <dl className="s-attributes">
      {attributes.map((a) => (
        <div key={a.id}>
          <dt>{a.name}</dt>
          <dd>{attributeLabel(a)}</dd>
        </div>
      ))}
    </dl>
  );
}
export function PriceDisplay({
  product,
  variant,
  detail = false,
}: {
  product: Product;
  variant?: Variant;
  detail?: boolean;
}) {
  const discounted = variant
    ? variant.discountPrice != null
    : !product.variants.length && product.discountPrice !== null;
  return (
    <div className={detail ? "s-detail-price" : "s-price"}>
      <strong>
        {!variant && product.variants.length > 1 ? "от " : ""}
        {money(productPrice(product, variant), product.currency)}
      </strong>
      {discounted && (
        <del>
          {money(variant?.price ?? product.basePrice, product.currency)}
        </del>
      )}
    </div>
  );
}
export function AvailabilityBadge({
  stock,
  detailed = false,
}: {
  stock: number | null;
  detailed?: boolean;
}) {
  return (
    <span className={stock !== null && stock > 0 ? "s-stock" : "s-muted"}>
      <span className="s-dot" />
      {stock === null
        ? "Уточнить наличие"
        : stock > 0
          ? `В наличии${detailed ? ` · ${stock} шт.` : ""}`
          : "Сейчас нет в наличии"}
    </span>
  );
}
