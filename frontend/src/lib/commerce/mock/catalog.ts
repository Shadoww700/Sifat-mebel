import type {
  CatalogData,
  CategoryDTO,
  TypeDTO,
  ProductDTO,
  VariantDTO,
  VariantValueDTO,
} from "../catalog-contracts";
import type {
  AttributeDTO,
  AttributeValueDTO,
  TypeAttributeDTO,
} from "../catalog-attributes";
import { mapCatalog } from "../catalog-mapper";

// Response-shaped frontend fixtures. Never posted to Django or inserted into a database.
// Prices, stocks, warranties and specifications are illustrative, not an offer.
const categories: CategoryDTO[] = [
  {
    id: 1,
    name: "Мебель",
    slug: "furniture",
    description: "Природные фактуры и предметы для вашего дома.",
    image: "/images/sifat-auth-interior.png",
    is_active: true,
    sort_order: 0,
  },
  {
    id: 2,
    name: "Электроника",
    slug: "electronics",
    description:
      "Техника для работы и повседневной жизни. Демонстрация другого типа товаров.",
    image: null,
    is_active: true,
    sort_order: 1,
  },
];
const types: TypeDTO[] = [
  { id: 1, name: "Кресла", slug: "chairs", category: 1 },
  { id: 2, name: "Диваны", slug: "sofas", category: 1 },
  { id: 3, name: "Журнальные столы", slug: "tables", category: 1 },
  { id: 4, name: "Комоды", slug: "storage", category: 1 },
  { id: 5, name: "Ноутбуки", slug: "laptops", category: 2 },
].map((t) => ({
  ...t,
  category_info: categories.find((c) => c.id === t.category)!,
  is_active: true,
  sort_order: t.id,
}));

const definitions: AttributeDTO[] = [
  {
    id: 1,
    name: "Материал каркаса",
    slug: "frame",
    data_type: "TEXT",
    unit: "",
  },
  { id: 2, name: "Обивка", slug: "fabric", data_type: "TEXT", unit: "" },
  {
    id: 3,
    name: "Высота посадки",
    slug: "seat-height",
    data_type: "NUMBER",
    unit: "см",
  },
  { id: 4, name: "Длина", slug: "length", data_type: "NUMBER", unit: "см" },
  { id: 5, name: "Цвет", slug: "color", data_type: "TEXT", unit: "" },
  { id: 6, name: "Покрытие", slug: "finish", data_type: "TEXT", unit: "" },
  { id: 7, name: "Высота", slug: "height", data_type: "NUMBER", unit: "см" },
  {
    id: 8,
    name: "Плавное закрывание",
    slug: "softclose",
    data_type: "BOOLEAN",
    unit: "",
  },
  { id: 9, name: "RAM", slug: "ram", data_type: "NUMBER", unit: "GB" },
  { id: 10, name: "Storage", slug: "storage", data_type: "NUMBER", unit: "GB" },
  {
    id: 11,
    name: "Сенсорный экран",
    slug: "touchscreen",
    data_type: "BOOLEAN",
    unit: "",
  },
];
// Each tuple is ProductType, Attribute, variant option. Rendering never relies on these IDs.
const links: TypeAttributeDTO[] = [
  [1, 1, false],
  [1, 2, false],
  [1, 3, false],
  [2, 2, false],
  [2, 4, true],
  [2, 5, true],
  [3, 1, false],
  [3, 6, false],
  [3, 7, false],
  [4, 1, false],
  [4, 8, false],
  [5, 9, true],
  [5, 10, true],
  [5, 5, false],
  [5, 11, false],
].map(([type, attr, option], index) => ({
  id: index + 1,
  product_type: Number(type),
  attribute: Number(attr),
  attribute_info: definitions.find((d) => d.id === attr)!,
  can_be_variant_option: Boolean(option),
  is_required: true,
  is_filterable: ![2, 3, 7].includes(Number(attr)),
  sort_order: index,
}));

const brands = [
  { id: 1, name: "Sifat Studio", slug: "sifat-studio" },
  { id: 2, name: "Forma Atelier", slug: "forma-atelier" },
  { id: 3, name: "Apple", slug: "apple" },
];
const products: ProductDTO[] = [
  {
    id: 1,
    name: "Кресло Orom",
    slug: "orom-lounge",
    product_type: 1,
    brand: 1,
    sku: "SM-1026",
    base_price: "4800.00",
    discount_price: "4200.00",
    description:
      "Мягкий изгиб орехового каркаса и фактурная обивка. Кресло для долгих разговоров, вечернего чтения и пауз, которые хочется продлить.",
  },
  {
    id: 2,
    name: "Диван Sokin",
    slug: "sokin-sofa",
    product_type: 2,
    brand: 1,
    sku: "SM-2026",
    base_price: "14800.00",
    discount_price: null,
    description:
      "Глубокая посадка, тёплый оттенок льна и спокойный силуэт. Выберите подходящую длину и оттенок — детали обсудим с вами в магазине.",
  },
  {
    id: 3,
    name: "Стол Davra",
    slug: "davra-table",
    product_type: 3,
    brand: 2,
    sku: "SM-3026",
    base_price: "3600.00",
    discount_price: null,
    description:
      "Выразительная текстура дерева и скульптурная опора. Плавная форма столешницы смягчает геометрию комнаты.",
  },
  {
    id: 4,
    name: "Комод Rhythm",
    slug: "rhythm-sideboard",
    product_type: 4,
    brand: 2,
    sku: "SM-4026",
    base_price: "8900.00",
    discount_price: "7900.00",
    description:
      "Ритм деревянных фасадов, тонкая опора и продуманное хранение. Для гостиной, столовой и любимых вещей.",
  },
  {
    id: 5,
    name: "MacBook Air M4",
    slug: "macbook-air-m4",
    product_type: 5,
    brand: 3,
    sku: "MBA-M4",
    base_price: "11900.00",
    discount_price: null,
    description:
      "Демонстрационный ноутбук в каталоге Sifat. Выберите объём оперативной памяти и накопителя. Цены и наличие здесь — примеры для проверки интерфейса.",
  },
].map((p) => ({
  ...p,
  product_type_info: types.find((t) => t.id === p.product_type)!,
  brand_info: brands.find((b) => b.id === p.brand)!,
  short_description: "",
  currency: "TJS",
  status: "ACTIVE",
  is_active: true,
  is_featured: p.id <= 2,
  warranty: "Уточняется у менеджера",
  country_of_origin: "",
}));
const variants: VariantDTO[] = [
  {
    id: 11,
    product: 1,
    name: "Букле / орех",
    sku: "SM-1026-B",
    price: "4800.00",
    discount_price: "4200.00",
    stock_quantity: 6,
  },
  {
    id: 21,
    product: 2,
    name: "240 см / бежевый",
    sku: "SM-2026-240-B",
    price: "14800.00",
    discount_price: null,
    stock_quantity: 3,
  },
  {
    id: 22,
    product: 2,
    name: "200 см / бежевый",
    sku: "SM-2026-200-B",
    price: "12600.00",
    discount_price: null,
    stock_quantity: 2,
  },
  {
    id: 23,
    product: 2,
    name: "280 см / графит",
    sku: "SM-2026-280-G",
    price: "16900.00",
    discount_price: null,
    stock_quantity: 0,
  },
  {
    id: 31,
    product: 3,
    name: "Орех",
    sku: "SM-3026-W",
    price: "3600.00",
    discount_price: null,
    stock_quantity: 8,
  },
  {
    id: 41,
    product: 4,
    name: "Орех",
    sku: "SM-4026-W",
    price: "8900.00",
    discount_price: "7900.00",
    stock_quantity: 0,
  },
  {
    id: 51,
    product: 5,
    name: "16GB / 256GB",
    sku: "MBA-M4-16-256",
    price: "11900.00",
    discount_price: null,
    stock_quantity: 4,
  },
  {
    id: 52,
    product: 5,
    name: "16GB / 512GB",
    sku: "MBA-M4-16-512",
    price: "13900.00",
    discount_price: "13400.00",
    stock_quantity: 7,
  },
  {
    id: 53,
    product: 5,
    name: "24GB / 512GB",
    sku: "MBA-M4-24-512",
    price: "15900.00",
    discount_price: null,
    stock_quantity: 0,
  },
].map((v) => ({ ...v, is_active: true }));

function typedValue(attribute: number, value: string | number | boolean) {
  return {
    attribute,
    attribute_info: definitions.find((d) => d.id === attribute)!,
    value_text: typeof value === "string" ? value : null,
    value_number: typeof value === "number" ? value.toFixed(2) : null,
    value_boolean: typeof value === "boolean" ? value : null,
  };
}
const productRows: [number, number, string | number | boolean][] = [
  [1, 1, "Массив ореха"],
  [1, 2, "Букле"],
  [1, 3, 42],
  [2, 2, "Смесовый лён"],
  [3, 1, "Массив ореха"],
  [3, 6, "Натуральное масло"],
  [3, 7, 38],
  [4, 1, "Шпон ореха"],
  [4, 8, true],
  [5, 5, "Midnight"],
  [5, 11, false],
];
const values: AttributeValueDTO[] = productRows.map(
  ([product, attr, value], i) => ({
    id: i + 1,
    product,
    ...typedValue(attr, value),
  }),
);
const variantRows: [number, number, string | number | boolean][] = [
  [21, 4, 240],
  [21, 5, "Бежевый"],
  [22, 4, 200],
  [22, 5, "Бежевый"],
  [23, 4, 280],
  [23, 5, "Графит"],
  [51, 9, 16],
  [51, 10, 256],
  [52, 9, 16],
  [52, 10, 512],
  [53, 9, 24],
  [53, 10, 512],
];
const variantValues: VariantValueDTO[] = variantRows.map(
  ([variant, attr, value], i) => ({
    id: i + 1,
    variant,
    ...typedValue(attr, value),
  }),
);

export const demoResponses: CatalogData = {
  categories,
  types,
  products,
  variants,
  variantValues,
  attributes: { definitions, links, values },
  images: ["lounge", "sofa", "table", "cabinet"].flatMap((image, i) => [
    {
      id: i * 2 + 1,
      product: i + 1,
      image: `/images/commerce/${image}.webp`,
      alt_text: products[i].name,
      is_primary: true,
      sort_order: 0,
    },
    {
      id: i * 2 + 2,
      product: i + 1,
      image: "/images/sifat-auth-interior.png",
      alt_text: "Интерьерное настроение коллекции, иллюстрация",
      is_primary: false,
      sort_order: 1,
    },
  ]),
};
export const demoCatalog = mapCatalog(demoResponses, "demo", (path) => path);
