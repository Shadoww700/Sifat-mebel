import { CartLine, Product, lineKey, productPrice } from "./models";
export function resolveCart(lines: CartLine[], products: Product[]) {
  return lines.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    const variant = product?.variants.find((v) => v.id === line.variantId);
    const invalidVariant = !!product?.variants.length && !variant;
    const limit = variant?.stock ?? product?.stock ?? 20;
    return {
      ...line,
      key: lineKey(line),
      product,
      variant,
      limit: Math.min(20, limit),
      price: product ? productPrice(product, variant) : 0,
      valid:
        !!product &&
        product.available &&
        !invalidVariant &&
        line.quantity <= limit &&
        (line.variantId === null || !!variant),
    };
  });
}
