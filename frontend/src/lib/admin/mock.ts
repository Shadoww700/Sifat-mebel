import { demoResponses } from "@/lib/commerce/mock/catalog";
import type { AdminAdapter } from "./api";
import {
  resourceKeys,
  resources,
  type AdminRow,
  type ResourceKey,
} from "./resources";

type Data = Record<ResourceKey, AdminRow[]>;
const rows = (input: { id: number }[]) =>
  input.map((row) => ({ ...row })) as AdminRow[];
const initial = (): Data => ({
  categories: rows(demoResponses.categories),
  "product-types": rows(demoResponses.types),
  brands: rows(
    [
      ...new Map(
        demoResponses.products.flatMap((p) =>
          p.brand_info ? [[p.brand_info.id, p.brand_info] as const] : [],
        ),
      ).values(),
    ].map((b) => ({ ...b, is_active: true, description: "" })),
  ),
  products: rows(demoResponses.products),
  "product-images": rows(demoResponses.images),
  attributes: rows(demoResponses.attributes!.definitions),
  "product-type-attributes": rows(demoResponses.attributes!.links),
  "product-attribute-values": rows(demoResponses.attributes!.values),
  "product-variants": rows(demoResponses.variants),
  "variant-attribute-values": rows(demoResponses.variantValues),
  "stock-movements": [],
});

/** User-scoped browser practice data, never used as an API failure fallback.
 * Session-only: changes do not publish to the public storefront or Django.
 */
export function createMockAdminAdapter(userId: number): AdminAdapter {
  const storageKey = `sifat-admin-demo-v1:${userId}`;
  let data = initial();
  try {
    const saved: unknown = JSON.parse(
      sessionStorage.getItem(storageKey) ?? "null",
    );
    if (
      saved &&
      typeof saved === "object" &&
      resourceKeys.every(
        (key) =>
          Array.isArray((saved as Data)[key]) &&
          (saved as Data)[key].every((row) => typeof row.id === "number"),
      )
    )
      data = saved as Data;
  } catch {
    /* Unavailable storage still allows a clearly session-only demo. */
  }
  const commit = (next: Data) => {
    // A quota error must be shown, not reported as a successful save.
    if (typeof sessionStorage !== "undefined")
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    data = next;
  };
  const fileUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Не удалось прочитать фотографию"));
      reader.readAsDataURL(file);
    });
  return {
    async list(key) {
      return structuredClone(data[key]);
    },
    async save(key, values, id) {
      if (resources[key].readOnly)
        throw new Error("Журнал доступен только для чтения");
      const next = structuredClone(data);
      const clean = { ...values };
      for (const [name, value] of Object.entries(clean))
        if (value instanceof File) clean[name] = await fileUrl(value);
      for (const unique of ["sku", "slug"])
        if (
          clean[unique] &&
          next[key].some(
            (row) =>
              row.id !== id &&
              row[unique] === clean[unique] &&
              (key !== "product-types" || row.category === clean.category),
          )
        )
          throw new Error(`${unique}: такое значение уже существует`);
      for (const pair of [
        key === "product-type-attributes"
          ? "product_type"
          : key === "product-attribute-values"
            ? "product"
            : key === "variant-attribute-values"
              ? "variant"
              : "",
      ]) {
        if (
          pair &&
          next[key].some(
            (row) =>
              row.id !== id &&
              row[pair] === clean[pair] &&
              row.attribute === clean.attribute,
          )
        )
          throw new Error("Такая характеристика уже назначена");
      }
      const current =
        id === undefined ? undefined : next[key].find((row) => row.id === id);
      if (id !== undefined && !current)
        throw new Error("Запись больше не существует");
      const row: AdminRow = {
        ...(key === "product-variants" ? { stock_quantity: 0 } : {}),
        ...current,
        ...clean,
        id: id ?? Math.max(0, ...next[key].map((row) => row.id)) + 1,
      };
      if (key === "product-images" && row.is_primary)
        next[key] = next[key].map((image) =>
          image.product === row.product
            ? { ...image, is_primary: false }
            : image,
        );
      next[key] = current
        ? next[key].map((entry) => (entry.id === id ? row : entry))
        : [...next[key], row];
      commit(next);
      return structuredClone(row);
    },
    async remove(key, id) {
      if (resources[key].readOnly)
        throw new Error("Нельзя удалить историю склада");
      const next = structuredClone(data);
      if (key === "products")
        next.products = next.products.map((p) =>
          p.id === id ? { ...p, is_active: false, status: "ARCHIVED" } : p,
        );
      else {
        if (
          resourceKeys.some((other) =>
            resources[other].fields.some(
              (field) =>
                field.ref === key &&
                next[other].some((row) => row[field.key] === id),
            ),
          ) ||
          (key === "product-variants" &&
            next["stock-movements"].some((m) => m.variant === id))
        )
          throw new Error(
            "Запись используется. Сначала измените связанные данные.",
          );
        next[key] = next[key].filter((row) => row.id !== id);
      }
      commit(next);
    },
    async adjust(values) {
      if (
        !Number.isInteger(values.quantity) ||
        values.quantity < 1 ||
        !["IN", "OUT"].includes(values.operation)
      )
        throw new Error(
          "Укажите корректную операцию и положительное целое количество",
        );
      const next = structuredClone(data);
      const variant = next["product-variants"].find(
        (v) => v.id === values.variant_id,
      );
      if (!variant) throw new Error("Вариант не найден");
      const stock =
        Number(variant.stock_quantity) +
        (values.operation === "IN" ? values.quantity : -values.quantity);
      if (stock < 0) throw new Error("Недостаточный остаток для списания");
      variant.stock_quantity = stock;
      const movement: AdminRow = {
        id: Math.max(0, ...next["stock-movements"].map((m) => m.id)) + 1,
        variant: variant.id,
        operation: values.operation,
        quantity: values.quantity,
        reason: values.reason,
        created_at: new Date().toISOString(),
      };
      next["stock-movements"].unshift(movement);
      commit(next);
      return structuredClone(movement);
    },
  };
}
