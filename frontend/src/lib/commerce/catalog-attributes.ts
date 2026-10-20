import type { Attribute } from "./models";

/** Read contracts from catalog/serializers.py; these are not new API schemas. */
export type AttributeDTO = {
  id: number;
  name: string;
  slug: string;
  data_type: "TEXT" | "NUMBER" | "BOOLEAN";
  unit: string;
};
export type TypeAttributeDTO = {
  id: number;
  product_type: number;
  attribute: number;
  attribute_info: AttributeDTO;
  is_required: boolean;
  is_filterable: boolean;
  can_be_variant_option?: boolean;
  sort_order: number;
};
export type AttributeValueDTO = {
  id: number;
  product: number;
  attribute: number;
  attribute_info: AttributeDTO;
  value_text: string | null;
  value_number: string | number | null;
  value_boolean: boolean | null;
};
export type AttributeData = {
  definitions: AttributeDTO[];
  links: TypeAttributeDTO[];
  values: AttributeValueDTO[];
};

export function productAttributes(
  productId: number,
  typeId: number,
  data: AttributeData,
): Attribute[] {
  const definitions = new Map(
    data.definitions.map((attribute) => [attribute.id, attribute]),
  );
  const values = new Map(
    data.values
      .filter((value) => value.product === productId)
      .map((value) => [value.attribute, value]),
  );
  return data.links
    .filter((link) => link.product_type === typeId)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .flatMap((link) => {
      const definition = definitions.get(link.attribute);
      const row = values.get(link.attribute);
      if (!definition || !row) return [];
      let value: Attribute["value"] | null = null;
      switch (definition.data_type) {
        case "TEXT":
          value =
            typeof row.value_text === "string" && row.value_text.trim()
              ? row.value_text
              : null;
          break;
        case "NUMBER":
          if (
            row.value_number !== null &&
            row.value_number !== undefined &&
            String(row.value_number).trim() !== ""
          ) {
            const number = Number(row.value_number);
            if (Number.isFinite(number)) value = number;
          }
          break;
        case "BOOLEAN":
          value =
            typeof row.value_boolean === "boolean" ? row.value_boolean : null;
          break;
      }
      // 0 and false are meaningful values. Missing values are not fabricated.
      return value === null
        ? []
        : [
            {
              id: String(definition.id),
              name: definition.name,
              value,
              unit: definition.unit || undefined,
              filterable: link.is_filterable,
              variantOption: link.can_be_variant_option === true,
            },
          ];
    });
}

export function attributeLabel(attribute: Pick<Attribute, "value" | "unit">) {
  if (typeof attribute.value === "boolean")
    return attribute.value ? "Да" : "Нет";
  const value =
    typeof attribute.value === "number"
      ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
          attribute.value,
        )
      : attribute.value;
  return `${value}${attribute.unit ? ` ${attribute.unit}` : ""}`;
}

// Typed tokens avoid conflating the string "false" with the boolean false.
export const attributeToken = (value: Attribute["value"]) =>
  `${typeof value}:${value}`;
