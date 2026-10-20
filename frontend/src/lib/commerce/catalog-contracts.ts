import type { AttributeData, AttributeValueDTO } from "./catalog-attributes";

/** Read projections of existing Django serializers, not invented endpoints.
 * Decimal fields retain DRF's string format until the shared mapper runs.
 * Audit timestamps/nested display objects are unused by presentation.
 */
export type CategoryDTO = {
  id: number;
  name: string;
  slug: string;
  description: string;
  image: string | null;
  is_active?: boolean;
  sort_order?: number;
};
export type TypeDTO = {
  id: number;
  name: string;
  slug: string;
  category: number;
  category_info: CategoryDTO;
  is_active?: boolean;
  sort_order?: number;
};
export type ProductDTO = {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  product_type: number;
  brand: number | null;
  product_type_info: TypeDTO;
  brand_info: { id: number; name: string; slug: string } | null;
  sku: string;
  base_price: string;
  discount_price: string | null;
  currency: string;
  status: string;
  is_active: boolean;
  warranty: string;
  country_of_origin: string;
  is_featured: boolean;
};
export type ImageDTO = {
  id: number;
  product: number;
  image: string;
  alt_text: string;
  is_primary: boolean;
  sort_order: number;
};
export type VariantDTO = {
  id: number;
  product: number;
  sku: string;
  name: string;
  price: string;
  discount_price: string | null;
  stock_quantity: number;
  is_active: boolean;
};
export type VariantValueDTO = Omit<AttributeValueDTO, "product"> & {
  variant: number;
};
export type CatalogData = {
  products: ProductDTO[];
  categories: CategoryDTO[];
  types: TypeDTO[];
  images: ImageDTO[];
  attributes: AttributeData | null;
  variants: VariantDTO[];
  variantValues: VariantValueDTO[];
};
