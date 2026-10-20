import { apiRequest } from "@/lib/api/client";
import { resources, type AdminRow, type ResourceKey } from "./resources";
import { readProductPage } from "@/lib/commerce/catalog-api";

export type AdminProductPage = {
  rows: AdminRow[];
  page: number;
  count: number;
  pages: number;
};

export type StockAdjustment = {
  variant_id: number;
  operation: "IN" | "OUT";
  quantity: number;
  reason: string;
};
export interface AdminAdapter {
  list(key: ResourceKey): Promise<AdminRow[]>;
  save(
    key: ResourceKey,
    values: Record<string, unknown>,
    id?: number,
  ): Promise<AdminRow>;
  remove(key: ResourceKey, id: number): Promise<void>;
  adjust(values: StockAdjustment): Promise<AdminRow>;
  productPage?: (page: number, search?: string) => Promise<AdminProductPage>;
  product?: (id: number) => Promise<AdminRow>;
}

/** Reads only existing collections; pagination never fetches an arbitrary URL. */
export async function listAdminRows(key: ResourceKey): Promise<AdminRow[]> {
  const path = `/catalog/${resources[key].list}`;
  const data = await apiRequest<AdminRow[] | { results: AdminRow[] }>(path, {
    cache: "no-store",
  });
  const batch = Array.isArray(data)
    ? data
    : key === "products"
      ? data.results
      : null;
  if (!Array.isArray(batch)) throw new Error("Некорректный список API");
  return batch;
}
export async function adminProductPage(
  page = 1,
  search = "",
): Promise<AdminProductPage> {
  const query = new URLSearchParams({
    page: String(page),
    page_size: "20",
    ordering: "-created_at",
  });
  if (search) query.set("search", search);
  const result = readProductPage(
    await apiRequest<
      AdminRow[] | import("@/lib/commerce/catalog-api").ProductPage<AdminRow>
    >(`/catalog/products?${query}`, { cache: "no-store" }),
  );
  return {
    rows: result.results,
    page,
    count: result.count,
    pages: Math.max(1, Math.ceil(result.count / 20)),
  };
}
async function adminProduct(id: number): Promise<AdminRow> {
  const detail = await apiRequest<AdminRow>(`/catalog/product/${id}`, {
    cache: "no-store",
  });
  // Detail serializer omits management flags. Read ONE bounded, name-searched
  // list page for the full edit representation; never fabricate is_active etc.
  const query = new URLSearchParams({
    search: String(detail.name),
    page_size: "100",
    page: "1",
  });
  const page = readProductPage(
    await apiRequest<
      AdminRow[] | import("@/lib/commerce/catalog-api").ProductPage<AdminRow>
    >(`/catalog/products?${query}`, { cache: "no-store" }),
  );
  const row = page.results.find((row) => row.id === id);
  if (!row)
    throw new Error(
      "Не удалось получить полные поля товара в первых 100 результатах поиска по имени. Откройте товар из списка управления. Для прямой ссылки без этого ограничения API нужны полные поля detail или фильтр по ID.",
    );
  return row;
}
function body(values: Record<string, unknown>) {
  if (!Object.values(values).some((v) => v instanceof File))
    return JSON.stringify(values);
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value instanceof File) form.set(key, value);
    else if (value !== null && value !== undefined)
      form.set(key, String(value));
  }
  return form;
}
export const apiAdminAdapter: AdminAdapter = {
  productPage: adminProductPage,
  product: adminProduct,
  list: listAdminRows,
  save: (key, values, id) =>
    apiRequest(
      `/catalog/${id === undefined ? resources[key].list : `${resources[key].detail}/${id}`}`,
      { method: id === undefined ? "POST" : "PATCH", body: body(values) },
    ),
  remove: (key, id) =>
    apiRequest(`/catalog/${resources[key].detail}/${id}`, { method: "DELETE" }),
  adjust: (values) =>
    apiRequest("/catalog/stock/adjust", {
      method: "POST",
      body: JSON.stringify(values),
    }),
};
