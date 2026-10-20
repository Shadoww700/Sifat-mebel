import { apiRequest } from "@/lib/api/client";
import { resources, type AdminRow, type ResourceKey } from "./resources";

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
}

/** Reads only existing collections; pagination never fetches an arbitrary URL. */
export async function listAdminRows(key: ResourceKey): Promise<AdminRow[]> {
  const path = `/catalog/${resources[key].list}`;
  let next: string | null = path;
  const visited = new Set<string>();
  const rows: AdminRow[] = [];
  while (next) {
    if (visited.has(next)) throw new Error("Повторяющаяся страница API");
    visited.add(next);
    const data: AdminRow[] | { results: AdminRow[]; next?: string | null } =
      await apiRequest(next, { cache: "no-store" });
    const batch = Array.isArray(data) ? data : data.results;
    if (!Array.isArray(batch)) throw new Error("Некорректный список API");
    rows.push(...batch);
    if (!Array.isArray(data) && data.next) {
      const url: URL = new URL(data.next, "http://pagination.local");
      if (url.pathname.replace(/\/$/, "") !== `/api/v1${path}`)
        throw new Error("Некорректная пагинация API");
      next = `${path}${url.search}`;
    } else next = null;
  }
  return rows;
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
