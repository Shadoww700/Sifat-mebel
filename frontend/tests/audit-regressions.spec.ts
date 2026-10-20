import { expect, test } from "@playwright/test";
import { apiRequest } from "../src/lib/api/client";
import { accountApi } from "../src/lib/account/api";

test("successful malformed JSON must reject instead of pretending a mutation succeeded; 204 remains valid", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("<html>Unexpected upstream page</html>", { status: 200 });
    await expect(
      apiRequest("/profile", { method: "PATCH", body: "{}" }),
    ).rejects.toThrow(/ответ/);
    globalThis.fetch = async () => new Response(null, { status: 204 });
    await expect(
      apiRequest("/profile/addresses/1", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  } finally {
    globalThis.fetch = original;
  }
});

test("address pagination rejects cycles instead of silently showing a partial list", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({
      results: [{ id: 1, title: "Дом" }],
      next: "https://django.test/api/v1/profile/addresses/?page=2",
    });
  };
  try {
    await expect(accountApi.addresses()).rejects.toThrow(/Повтор/);
    expect(calls).toHaveLength(2);
    expect(
      calls.every((url) => url.startsWith("/api/backend/v1/profile/addresses")),
    ).toBe(true);
  } finally {
    globalThis.fetch = original;
  }
});

test("address pagination rejects malformed data and unrelated next routes without making extra requests", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ results: null, next: null });
    await expect(accountApi.addresses()).rejects.toThrow(/Некоррект/);
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({
        results: [],
        next: "https://untrusted.test/private?page=2",
      });
    };
    await expect(accountApi.addresses()).rejects.toThrow(/Некоррект/);
    expect(calls).toBe(1);
  } finally {
    globalThis.fetch = original;
  }
});

test("show all products clears an invalid category from the initial catalog URL", async ({
  page,
}) => {
  await page.goto("/catalog?category=999&q=НетТакогоТовара");
  await expect(
    page.getByRole("heading", { name: "Пока ничего не нашлось" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Показать все предметы" }).click();
  await expect(page.locator("#store-content .s-product-card")).toHaveCount(5);
  expect(new URL(page.url()).searchParams.has("category")).toBe(false);
});

test("show all products preserves the category on a category-specific page", async ({
  page,
}) => {
  await page.goto("/categories/furniture?q=НетТакогоТовара");
  await page.getByRole("button", { name: "Показать все предметы" }).click();
  await expect(page.locator("#store-content .s-product-card")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { level: 1, name: "Мебель", exact: true }),
  ).toBeVisible();
});
