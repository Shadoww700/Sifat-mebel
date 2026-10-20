import {
  resources,
  type AdminRow,
  type Field,
  type ResourceKey,
} from "./resources";

export type ReferenceData = Partial<Record<ResourceKey, AdminRow[]>>;
export type Draft = Record<string, string | boolean | File>;
export function initialDraft(key: ResourceKey, row?: AdminRow): Draft {
  return Object.fromEntries(
    resources[key].fields.map((f) => [
      f.key,
      f.type === "file"
        ? ""
        : f.type === "boolean"
          ? Boolean(row?.[f.key] ?? f.default ?? false)
          : String(row?.[f.key] ?? f.default ?? ""),
    ]),
  );
}
export function valueField(draft: Draft, data: ReferenceData) {
  const attribute = data.attributes?.find(
    (a) => a.id === Number(draft.attribute),
  );
  return (
    (
      {
        TEXT: "value_text",
        NUMBER: "value_number",
        BOOLEAN: "value_boolean",
      } as Record<string, string>
    )[String(attribute?.data_type)] ?? null
  );
}
export function referenceOptions(
  field: Field,
  draft: Draft,
  data: ReferenceData,
  key: ResourceKey,
) {
  const all = (field.ref ? (data[field.ref] ?? []) : []).filter((row) => {
    // Match the existing serializer PK querysets, not invented frontend rules.
    if (
      field.ref === "product-types" &&
      ["products", "product-type-attributes"].includes(key)
    )
      return row.is_active !== false;
    if (
      field.ref === "products" &&
      ["product-variants", "product-attribute-values"].includes(key)
    )
      return row.is_active !== false;
    if (field.ref === "product-variants" && key === "variant-attribute-values")
      return row.is_active !== false;
    return true;
  });
  if (field.key !== "attribute" || !key.endsWith("attribute-values"))
    return all;
  const variant =
    key === "variant-attribute-values"
      ? data["product-variants"]?.find((v) => v.id === Number(draft.variant))
      : null;
  const product = data.products?.find(
    (p) => p.id === Number(variant?.product ?? draft.product),
  );
  const allowed =
    data["product-type-attributes"]
      ?.filter(
        (link) =>
          link.product_type === product?.product_type &&
          (key !== "variant-attribute-values" ||
            link.can_be_variant_option === true),
      )
      .map((link) => link.attribute) ?? [];
  return all.filter((a) => allowed.includes(a.id));
}
export function payloadFor(
  key: ResourceKey,
  draft: Draft,
  data: ReferenceData,
  editing: boolean,
) {
  const errors: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const chosenValue = valueField(draft, data);
  for (const field of resources[key].fields) {
    const input = draft[field.key];
    if (field.key.startsWith("value_") && field.key !== chosenValue) {
      values[field.key] = null;
      continue;
    }
    if (field.type === "file") {
      if (input instanceof File) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(input.type) ||
          input.size > 3 * 1024 * 1024
        )
          errors[field.key] = "JPG, PNG или WebP до 3 МБ";
        else values[field.key] = input;
      } else if (field.required && !editing)
        errors[field.key] = "Выберите файл";
      continue;
    }
    if (field.type === "boolean") {
      values[field.key] = input === true;
      continue;
    }
    const text = typeof input === "string" ? input.trim() : "";
    const required = field.required || field.key === chosenValue;
    if (!text && required) errors[field.key] = "Заполните поле";
    if (field.max && text.length > field.max)
      errors[field.key] = `Не более ${field.max} символов`;
    if (text && field.key === "slug" && !/^[a-zA-Z0-9_-]+$/.test(text))
      errors[field.key] = "Латинские буквы, цифры, дефис или подчёркивание";
    if (field.options && text && !field.options.includes(text))
      errors[field.key] = "Выберите значение из списка";
    if ((field.type === "number" || field.type === "decimal") && text) {
      const number = Number(text);
      if (
        !Number.isFinite(number) ||
        (field.type === "number" && !Number.isInteger(number)) ||
        (field.min !== undefined && number < field.min) ||
        (field.type === "decimal" && !/^-?\d{1,10}(\.\d{1,2})?$/.test(text))
      )
        errors[field.key] = "Проверьте число (не более 2 знаков после точки)";
      if (
        ["price", "base_price", "discount_price"].includes(field.key) &&
        number > 99999999.99
      )
        errors[field.key] = "Цена слишком велика";
    }
    if (
      field.type === "ref" &&
      !referenceOptions(field, draft, data, key).some(
        (row) => row.id === Number(text),
      )
    )
      errors[field.key] = "Выберите допустимую связанную запись";
    values[field.key] =
      !text && field.nullable
        ? null
        : field.key === "value_boolean"
          ? text === "true"
          : ["number", "ref"].includes(field.type ?? "")
            ? Number(text)
            : text;
  }
  if (
    values.discount_price !== null &&
    values.discount_price !== undefined &&
    Number(values.discount_price) > Number(values.base_price ?? values.price)
  )
    errors.discount_price = "Скидочная цена не может быть выше основной";
  return { values, errors };
}
