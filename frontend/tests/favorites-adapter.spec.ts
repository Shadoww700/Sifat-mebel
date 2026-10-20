import { expect, test } from "@playwright/test";
import { favoritesApi } from "../src/lib/commerce/favorites-api";
import { resolveDataSources } from "../src/lib/commerce/data-source";
test("backend is the default source; demo is explicit and admin source stays consistent", () => {
  expect(resolveDataSources({})).toEqual({
    catalogSource: "api",
    adminSource: "api",
  });
  expect(resolveDataSources({ catalog: "demo" })).toEqual({
    catalogSource: "demo",
    adminSource: "demo",
  });
  expect(resolveDataSources({ catalog: "api", admin: "demo" })).toEqual({
    catalogSource: "api",
    adminSource: "demo",
  });
  expect(resolveDataSources({ catalog: "unknown" })).toEqual({
    catalogSource: "api",
    adminSource: "api",
  });
});
test("favorites adapter follows pagination through proxy, posts product PK and deletes favorite PK", async () => {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  const row = { id: 701, product: 1, created_at: "2026-10-18T10:00:00Z" };
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (init?.method === "POST") return Response.json(row, { status: 200 });
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json(
      String(input).includes("page=2")
        ? { results: [{ ...row, id: 702, product: 2 }], next: null }
        : {
            results: [row],
            next: "http://django.test/api/v1/catalog/favorites/?page=2",
          },
    );
  };
  try {
    expect(await favoritesApi.list()).toHaveLength(2);
    expect(await favoritesApi.add(1)).toEqual(row);
    await favoritesApi.remove(701);
    expect(calls.map((call) => [call.url, call.init?.method ?? "GET"])).toEqual(
      [
        ["/api/backend/v1/catalog/favorites", "GET"],
        ["/api/backend/v1/catalog/favorites?page=2", "GET"],
        ["/api/backend/v1/catalog/favorites", "POST"],
        ["/api/backend/v1/catalog/favorites/701", "DELETE"],
      ],
    );
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({ product: 1 });
    expect(
      calls.every((call) => call.init?.credentials === "same-origin"),
    ).toBe(true);
  } finally {
    globalThis.fetch = original;
  }
});
test("favorites adapter rejects invalid responses and foreign collection pagination without fallback", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({
        results: [],
        next: "https://untrusted.test/private/data",
      });
    await expect(favoritesApi.list()).rejects.toThrow("Некорректная пагинация");
    globalThis.fetch = async () =>
      Response.json([{ id: 1, product: "not-a-pk" }]);
    await expect(favoritesApi.list()).rejects.toThrow("Некорректный ответ");
    globalThis.fetch = async () =>
      Response.json({ detail: "Service unavailable" }, { status: 503 });
    await expect(favoritesApi.list()).rejects.toMatchObject({ status: 503 });
  } finally {
    globalThis.fetch = original;
  }
});
