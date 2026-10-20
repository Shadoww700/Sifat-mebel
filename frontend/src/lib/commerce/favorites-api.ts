import { apiRequest } from "@/lib/api/client";

/** FavoriteSerializer: user is HiddenField; product is a PK, not a nested card. */
export type FavoriteDTO = { id: number; product: number; created_at: string };
const collection = "/catalog/favorites";
function record(value: unknown): FavoriteDTO {
  const row = value as FavoriteDTO | null;
  if (
    !row ||
    !Number.isSafeInteger(row.id) ||
    row.id < 1 ||
    !Number.isSafeInteger(row.product) ||
    row.product < 1 ||
    typeof row.created_at !== "string"
  )
    throw new Error("Некорректный ответ API избранного");
  return { id: row.id, product: row.product, created_at: row.created_at };
}
export const favoritesApi = {
  async list(): Promise<FavoriteDTO[]> {
    let path: string | null = collection;
    const visited = new Set<string>();
    const rows: FavoriteDTO[] = [];
    while (path) {
      if (visited.has(path))
        throw new Error("Повторяющаяся страница избранного");
      visited.add(path);
      const data: unknown = await apiRequest(path, { cache: "no-store" });
      const page = data as { results?: unknown; next?: unknown } | null;
      const batch = Array.isArray(data) ? data : page?.results;
      if (!Array.isArray(batch))
        throw new Error("Некорректный список избранного");
      rows.push(...batch.map(record));
      path = null;
      if (!Array.isArray(data) && page?.next) {
        if (typeof page.next !== "string")
          throw new Error("Некорректная пагинация избранного");
        const next = new URL(page.next, "http://pagination.local");
        if (next.pathname.replace(/\/$/, "") !== `/api/v1${collection}`)
          throw new Error("Некорректная пагинация избранного");
        // Never fetch the URL's origin: only the same collection via JWT proxy.
        path = `${collection}${next.search}`;
      }
    }
    return [...new Map(rows.map((row) => [row.product, row])).values()];
  },
  async add(productId: number) {
    if (!Number.isSafeInteger(productId) || productId < 1)
      throw new Error("Некорректный ID товара");
    const saved = record(
      await apiRequest(collection, {
        method: "POST",
        body: JSON.stringify({ product: productId }),
      }),
    );
    if (saved.product !== productId) throw new Error("API вернул другой товар");
    return saved;
  },
  async remove(favoriteId: number) {
    if (!Number.isSafeInteger(favoriteId) || favoriteId < 1)
      throw new Error("Некорректный ID избранного");
    await apiRequest(`${collection}/${favoriteId}`, { method: "DELETE" });
  },
};
