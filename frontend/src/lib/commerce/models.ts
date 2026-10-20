/** View models, independent of Django's wire format. */
export type DataSource = "demo" | "api";
export type ProductImage = { src: string; alt: string };
export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
};
export type ProductType = {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
};
export type Attribute = {
  id: string;
  name: string;
  value: string | number | boolean;
  unit?: string;
  filterable?: boolean;
  variantOption?: boolean;
};
export type Variant = {
  id: string;
  name: string;
  price: number;
  discountPrice?: number | null;
  sku?: string;
  stock: number | null;
  attributes: Attribute[];
};
export type Product = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  productType: ProductType;
  description: string;
  sku: string;
  images: ProductImage[];
  basePrice: number;
  discountPrice: number | null;
  currency: string;
  available: boolean;
  stock: number | null;
  badge?: string;
  attributes: Attribute[];
  variants: Variant[];
  warranty: string;
  country: string;
  delivery: string;
  source: DataSource;
};
export type Catalog = {
  products: Product[];
  categories: Category[];
  types: ProductType[];
  source: DataSource;
  issues?: { scope: "images" | "attributes" | "variants"; message: string }[];
};
export type CartLine = {
  productId: string;
  variantId: string | null;
  quantity: number;
};
export type OrderItem = {
  key: string;
  name: string;
  variant: string;
  image: string;
  price: number;
  quantity: number;
};
export type DeliveryAddress = {
  recipient: string;
  phone: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
};
export type Order = {
  id: string;
  createdAt: string;
  status: "created" | "preparing" | "delivered";
  items: OrderItem[];
  delivery: "delivery" | "pickup";
  address: DeliveryAddress;
  deliveryPrice: number;
  source: "demo";
};
export const productPrice = (product: Product, variant?: Variant) =>
  variant
    ? (variant.discountPrice ?? variant.price)
    : product.variants.length
      ? Math.min(...product.variants.map((v) => v.discountPrice ?? v.price))
      : (product.discountPrice ?? product.basePrice);
export const lineKey = (line: Pick<CartLine, "productId" | "variantId">) =>
  `${line.productId}:${line.variantId ?? "base"}`;
export const money = (value: number, currency = "TJS") =>
  `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${currency === "TJS" ? "сомони" : currency}`;
