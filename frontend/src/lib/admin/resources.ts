export const resourceKeys = [
  "categories",
  "product-types",
  "brands",
  "products",
  "product-images",
  "attributes",
  "product-type-attributes",
  "product-attribute-values",
  "product-variants",
  "variant-attribute-values",
  "stock-movements",
] as const;
export type ResourceKey = (typeof resourceKeys)[number];
export type AdminRow = { id: number; [key: string]: unknown };
export type AdminSource = "api" | "demo";
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "decimal"
    | "boolean"
    | "select"
    | "ref"
    | "file";
  required?: boolean;
  nullable?: boolean;
  max?: number;
  min?: number;
  default?: string | number | boolean;
  options?: readonly string[];
  ref?: ResourceKey;
  optionLabels?: Record<string, string>;
};
export type Resource = {
  title: string;
  singular: string;
  description: string;
  list: string;
  detail: string;
  fields: Field[];
  columns: string[];
  dependencies?: ResourceKey[];
  readOnly?: boolean;
};
const name: Field = {
  key: "name",
  label: "Название",
  required: true,
  max: 100,
};
const slug: Field = { key: "slug", label: "Slug", required: true, max: 50 };
const active: Field = {
  key: "is_active",
  label: "Активно",
  type: "boolean",
  default: true,
};
const order: Field = {
  key: "sort_order",
  label: "Порядок",
  type: "number",
  min: 0,
  default: 0,
};
const description: Field = {
  key: "description",
  label: "Описание",
  type: "textarea",
};
const ref = (key: string, label: string, resource: ResourceKey): Field => ({
  key,
  label,
  type: "ref",
  ref: resource,
  required: true,
});
const price = (key: string, label: string, nullable = false): Field => ({
  key,
  label,
  type: "decimal",
  min: 0,
  nullable,
  required: !nullable,
});
const attributeValues: Field[] = [
  ref("attribute", "Характеристика", "attributes"),
  { key: "value_text", label: "Текстовое значение", max: 255, nullable: true },
  {
    key: "value_number",
    label: "Числовое значение",
    type: "decimal",
    nullable: true,
  },
  {
    key: "value_boolean",
    label: "Логическое значение",
    type: "select",
    options: ["true", "false"],
    nullable: true,
  },
];

/** Existing Django contracts, not generated/invented backend APIs. */
export const resources: Record<ResourceKey, Resource> = {
  categories: {
    title: "Категории",
    singular: "категорию",
    description:
      "Верхний уровень каталога: мебель, электроника и другие направления.",
    list: "categories",
    detail: "categories",
    columns: ["name", "slug", "is_active"],
    fields: [
      name,
      slug,
      description,
      { key: "image", label: "Обложка", type: "file" },
      active,
      order,
      { key: "meta_title", label: "SEO-заголовок", max: 255 },
      { key: "meta_description", label: "SEO-описание", max: 500 },
    ],
  },
  "product-types": {
    title: "Типы товаров",
    singular: "тип товара",
    description:
      "Тип принадлежит категории и определяет доступную схему характеристик.",
    list: "product-types",
    detail: "product-types",
    columns: ["name", "category", "is_active"],
    fields: [
      name,
      slug,
      ref("category", "Категория", "categories"),
      active,
      order,
    ],
  },
  brands: {
    title: "Бренды",
    singular: "бренд",
    description: "Производители и марки товаров.",
    list: "brands",
    detail: "brands",
    columns: ["name", "slug", "is_active"],
    fields: [
      name,
      slug,
      description,
      { key: "logo", label: "Логотип", type: "file" },
      active,
    ],
  },
  products: {
    title: "Товары",
    singular: "товар",
    description:
      "Основная информация, публикация и цены. Исполнения и изображения управляются отдельно.",
    list: "products",
    detail: "product",
    columns: ["name", "sku", "status", "base_price"],
    fields: [
      name,
      slug,
      ref("product_type", "Тип товара", "product-types"),
      ref("brand", "Бренд", "brands"),
      { key: "sku", label: "Артикул", required: true, max: 255 },
      {
        key: "short_description",
        label: "Краткое описание",
        required: true,
        max: 150,
      },
      { ...description, required: true },
      price("base_price", "Базовая цена"),
      price("discount_price", "Цена со скидкой", true),
      {
        key: "currency",
        label: "Валюта",
        type: "select",
        options: ["TJS", "USD"],
        default: "TJS",
      },
      {
        key: "status",
        label: "Статус",
        type: "select",
        options: ["DRAFT", "ACTIVE", "OUT_OF_STOCK", "ARCHIVED"],
        default: "DRAFT",
      },
      active,
      { key: "is_featured", label: "В коллекции", type: "boolean" },
      { key: "warranty", label: "Гарантия", max: 100 },
      { key: "country_of_origin", label: "Страна производства", max: 100 },
    ],
  },
  "product-images": {
    title: "Изображения",
    singular: "изображение",
    description: "Загрузите файл, укажите подпись и основное фото товара.",
    list: "product-image",
    detail: "product-image",
    columns: ["image", "product", "alt_text", "is_primary"],
    fields: [
      ref("product", "Товар", "products"),
      { key: "image", label: "Фотография", type: "file", required: true },
      { key: "alt_text", label: "Описание фотографии", max: 255 },
      { key: "is_primary", label: "Основное фото", type: "boolean" },
      order,
    ],
  },
  attributes: {
    title: "Характеристики",
    singular: "характеристику",
    description:
      "Переиспользуемые определения: текст, число с единицей или Да/Нет.",
    list: "attributes",
    detail: "attributes",
    columns: ["name", "data_type", "unit"],
    fields: [
      name,
      slug,
      {
        key: "data_type",
        label: "Тип значения",
        type: "select",
        options: ["TEXT", "NUMBER", "BOOLEAN"],
        default: "TEXT",
        required: true,
        optionLabels: { TEXT: "Текст", NUMBER: "Число", BOOLEAN: "Да / Нет" },
      },
      { key: "unit", label: "Единица измерения", max: 255 },
    ],
  },
  "product-type-attributes": {
    title: "Схемы типов",
    singular: "привязку характеристики",
    description: "Разрешённые характеристики типа, фильтры и опции вариантов.",
    list: "product-type-attributes",
    detail: "product-type-attributes",
    columns: [
      "product_type",
      "attribute",
      "can_be_variant_option",
      "is_filterable",
    ],
    fields: [
      ref("product_type", "Тип товара", "product-types"),
      ref("attribute", "Характеристика", "attributes"),
      {
        key: "can_be_variant_option",
        label: "Опция варианта",
        type: "boolean",
      },
      { key: "is_required", label: "Обязательная", type: "boolean" },
      { key: "is_filterable", label: "Доступна в фильтрах", type: "boolean" },
      order,
    ],
  },
  "product-attribute-values": {
    title: "Значения товаров",
    singular: "значение товара",
    description:
      "Характеристики всего товара. Поле значения зависит от выбранного определения.",
    list: "product-attribute-values",
    detail: "product-attribute-values",
    columns: [
      "product",
      "attribute",
      "value_text",
      "value_number",
      "value_boolean",
    ],
    dependencies: ["product-type-attributes"],
    fields: [ref("product", "Товар", "products"), ...attributeValues],
  },
  "product-variants": {
    title: "Варианты",
    singular: "вариант",
    description:
      "Конкретные SKU, цены и доступность. Остаток меняется через раздел склада.",
    list: "product-variants",
    detail: "product-variants",
    columns: ["name", "sku", "price", "stock_quantity"],
    fields: [
      ref("product", "Товар", "products"),
      { ...name, max: 255 },
      { key: "sku", label: "Артикул варианта", required: true, max: 255 },
      price("price", "Цена"),
      price("discount_price", "Цена со скидкой", true),
      active,
    ],
  },
  "variant-attribute-values": {
    title: "Значения вариантов",
    singular: "значение варианта",
    description:
      "Структурированные опции конкретного SKU — только разрешённые его типом.",
    list: "variant-attribute-values",
    detail: "variant-attribute-values",
    columns: [
      "variant",
      "attribute",
      "value_text",
      "value_number",
      "value_boolean",
    ],
    dependencies: ["products", "product-type-attributes"],
    fields: [ref("variant", "Вариант", "product-variants"), ...attributeValues],
  },
  "stock-movements": {
    title: "История склада",
    singular: "движение",
    description:
      "Журнал поступлений и списаний. Исправление — отдельной корректировкой, без удаления истории.",
    list: "stock/movements",
    detail: "",
    readOnly: true,
    columns: ["variant", "operation", "quantity", "reason", "created_at"],
    fields: [],
    dependencies: ["product-variants"],
  },
};
export const isResourceKey = (value: string): value is ResourceKey =>
  resourceKeys.includes(value as ResourceKey);
export const rowTitle = (row: AdminRow) =>
  String(row.name ?? row.sku ?? row.alt_text ?? `Запись #${row.id}`);
export const resourceDependencies = (key: ResourceKey) => [
  ...new Set([
    ...resources[key].fields.flatMap((f) => (f.ref ? [f.ref] : [])),
    ...(resources[key].dependencies ?? []),
  ]),
];
