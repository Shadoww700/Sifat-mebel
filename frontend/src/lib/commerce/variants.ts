import type { Attribute, Product, Variant } from "./models";
import { attributeToken } from "./catalog-attributes";

export type VariantSelection = Record<string, string>;
export const selectionFor = (variant?: Variant): VariantSelection =>
  Object.fromEntries(
    (variant?.attributes ?? [])
      .filter((a) => a.variantOption)
      .map((a) => [a.id, attributeToken(a.value)]),
  );
export function variantAxes(variants: Variant[]) {
  const axes = new Map<
    string,
    { id: string; name: string; options: Attribute[] }
  >();
  for (const variant of variants)
    for (const attr of variant.attributes) {
      if (!attr.variantOption) continue;
      const axis = axes.get(attr.id) ?? {
        id: attr.id,
        name: attr.name,
        options: [],
      };
      if (
        !axis.options.some(
          (a) => attributeToken(a.value) === attributeToken(attr.value),
        )
      )
        axis.options.push(attr);
      axes.set(attr.id, axis);
    }
  return [...axes.values()].map((axis) => ({
    ...axis,
    options: axis.options.sort((a, b) =>
      typeof a.value === "number" && typeof b.value === "number"
        ? a.value - b.value
        : String(a.value).localeCompare(String(b.value), "ru"),
    ),
  }));
}
export function matchingVariants(
  variants: Variant[],
  selection: VariantSelection,
) {
  return variants.filter((variant) =>
    Object.entries(selection).every(([id, value]) =>
      variant.attributes.some(
        (a) => a.id === id && attributeToken(a.value) === value,
      ),
    ),
  );
}
/** Changing a leading axis clears incompatible subsequent values rather than
 * silently choosing a different SKU. Impossible options on later axes are disabled. */
export function chooseOption(
  variants: Variant[],
  current: VariantSelection,
  axisId: string,
  value: string,
): VariantSelection {
  const axes = variantAxes(variants);
  const index = axes.findIndex((a) => a.id === axisId);
  const next = Object.fromEntries(
    axes
      .slice(0, index)
      .filter((a) => current[a.id])
      .map((a) => [a.id, current[a.id]]),
  );
  next[axisId] = value;
  for (const axis of axes.slice(index + 1)) {
    if (
      current[axis.id] &&
      matchingVariants(variants, { ...next, [axis.id]: current[axis.id] })
        .length
    )
      next[axis.id] = current[axis.id];
    else {
      const candidates = matchingVariants(variants, next);
      const options = new Set(
        candidates.map((v) => selectionFor(v)[axis.id]).filter(Boolean),
      );
      if (options.size === 1) next[axis.id] = [...options][0];
    }
  }
  return next;
}
export function resolvedAttributes(product: Product, variant?: Variant) {
  return [
    ...product.attributes.filter(
      (a) => !variant?.attributes.some((v) => v.id === a.id),
    ),
    ...(variant?.attributes ?? []),
  ];
}
