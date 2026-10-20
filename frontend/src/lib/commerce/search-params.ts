import { emptyFilters, type BrowseFilters } from "./browse";
export function browseParams(
  params: Record<string, string | string[] | undefined>,
): BrowseFilters {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : (value ?? "");
  };
  const price = (key: string) =>
    /^\d+(\.\d{1,2})?$/.test(first(key)) ? first(key) : "";
  return {
    ...emptyFilters,
    query: first("q").slice(0, 200),
    category: first("category"),
    type: first("type"),
    brand: first("brand"),
    min: price("min"),
    max: price("max"),
    available: first("available") === "true",
    sort: first("sort") || "featured",
    attributes: Object.fromEntries(
      Object.keys(params)
        .filter((key) => /^attr\.[a-z0-9_-]{1,64}$/i.test(key) && first(key))
        .map((key) => [key.slice(5), first(key).slice(0, 300)]),
    ),
  };
}
