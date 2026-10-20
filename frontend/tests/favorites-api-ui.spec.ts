import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { demoResponses } from "../src/lib/commerce/mock/catalog";
import type { FavoriteDTO } from "../src/lib/commerce/favorites-api";

// A separate API-mode Next server and HTTP stub: no live Django/DB writes.
test.describe.configure({ mode: "serial" });
let upstream: Server, frontend: ChildProcess, origin: string;
let listStatus = 200,
  writeStatus = 200,
  sessionStatus = 200;
let outOfStockId: number | null = null;
const records = new Map<string, FavoriteDTO[]>();
const writes: { method: string; path: string; body: unknown }[] = [];
const reads: string[] = [];
const publicProducts = [
  ...demoResponses.products,
  ...Array.from({ length: 40 }, (_, index) => ({
    ...demoResponses.products[0],
    id: 100 + index,
    name: `Стул ${index + 1}`,
    slug: `chair-${index + 1}`,
    sku: `PAGE-${index + 1}`,
    base_price: String(100 + index),
    discount_price: null,
  })),
];
const favorite = (id: number, product: number): FavoriteDTO => ({
  id,
  product,
  created_at: "2026-10-18T10:00:00Z",
});
test.beforeAll(async () => {
  upstream = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://stub");
    const path = url.pathname;
    if (req.method === "GET" && path.startsWith("/api/v1/catalog/"))
      reads.push(path + url.search);
    const account = req.headers.authorization?.replace("Bearer ", "") ?? "";
    res.setHeader("content-type", "application/json");
    if (path === "/api/v1/auth/me/") {
      res.statusCode = sessionStatus;
      res.end(
        JSON.stringify(
          sessionStatus === 200
            ? {
                id: account === "account-b" ? 12 : 11,
                email: `${account}@example.test`,
                role: "USER",
                first_name: "Саид",
                last_name: "",
              }
            : { detail: "Сервис сессии недоступен" },
        ),
      );
      return;
    }
    const fixtures: Record<string, unknown> = {
      categories: demoResponses.categories,
      "product-types": demoResponses.types,
      products: demoResponses.products,
      "product-image": demoResponses.images,
      attributes: demoResponses.attributes!.definitions,
      "product-type-attributes": demoResponses.attributes!.links,
      "product-attribute-values": demoResponses.attributes!.values,
      "product-variants": demoResponses.variants,
      "variant-attribute-values": demoResponses.variantValues,
    };
    if (path.includes("/favorites")) {
      if (!account) {
        res.statusCode = 401;
        res.end("{}");
        return;
      }
      const list = records.get(account) ?? [];
      if (req.method === "GET") {
        res.statusCode = listStatus;
        res.end(
          JSON.stringify(
            listStatus === 200
              ? list
              : { detail: "Избранное временно недоступно" },
          ),
        );
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : null;
      writes.push({ method: req.method!, path, body });
      if (writeStatus !== 200) {
        res.statusCode = writeStatus;
        res.end(JSON.stringify({ detail: "Изменение отклонено сервером" }));
        return;
      }
      if (req.method === "POST") {
        const existing = list.find((row) => row.product === body.product);
        const row = existing ?? favorite(701 + list.length, body.product);
        if (!existing) records.set(account, [...list, row]);
        res.statusCode = existing ? 200 : 201;
        res.end(JSON.stringify(row));
      } else {
        const id = Number(path.split("/").filter(Boolean).at(-1));
        records.set(
          account,
          list.filter((row) => row.id !== id),
        );
        res.statusCode = 204;
        res.end();
      }
      return;
    }
    const key = path.replace("/api/v1/catalog/", "").replace(/\/$/, "");
    if (key === "products") {
      let products = publicProducts.map((p) =>
        p.id === outOfStockId ? { ...p, status: "OUT_OF_STOCK" } : p,
      );
      const q = url.searchParams;
      if (q.get("search"))
        products = products.filter((p) =>
          `${p.name} ${p.short_description} ${p.brand_info?.name}`
            .toLowerCase()
            .includes(q.get("search")!.toLowerCase()),
        );
      if (q.get("brand_id"))
        products = products.filter(
          (p) => String(p.brand) === q.get("brand_id"),
        );
      if (q.get("category_id"))
        products = products.filter(
          (p) => String(p.product_type_info.category) === q.get("category_id"),
        );
      if (q.get("min_price"))
        products = products.filter(
          (p) => Number(p.base_price) >= Number(q.get("min_price")),
        );
      if (q.get("max_price"))
        products = products.filter(
          (p) => Number(p.base_price) <= Number(q.get("max_price")),
        );
      if (["base_price", "-base_price"].includes(q.get("ordering") ?? ""))
        products.sort(
          (a, b) =>
            (Number(a.base_price) - Number(b.base_price)) *
            (q.get("ordering") === "-base_price" ? -1 : 1),
        );
      const page = Number(q.get("page") ?? 1),
        size = Number(q.get("page_size") ?? 20);
      if (page > Math.max(1, Math.ceil(products.length / size))) {
        res.statusCode = 404;
        res.end(JSON.stringify({ detail: "Invalid page." }));
        return;
      }
      res.end(
        JSON.stringify({
          count: products.length,
          next:
            page * size < products.length
              ? `http://untrusted.example/products/?page=${page + 1}`
              : null,
          previous: page > 1 ? `http://stub/products/?page=${page - 1}` : null,
          results: products.slice((page - 1) * size, page * size),
        }),
      );
      return;
    }
    if (key === "product-image") {
      const ids = (url.searchParams.get("product_ids") ?? "")
        .split(",")
        .map(Number);
      // A missing filter is a regression: never emulate downloading all photos.
      res.statusCode = url.searchParams.has("product_ids") ? 200 : 400;
      res.end(
        JSON.stringify(
          demoResponses.images.filter((image) => ids.includes(image.product)),
        ),
      );
      return;
    }
    if (key === "brands") {
      res.end(
        JSON.stringify([
          ...new Map(
            demoResponses.products.flatMap((p) =>
              p.brand_info ? [[p.brand_info.id, p.brand_info] as const] : [],
            ),
          ).values(),
        ]),
      );
      return;
    }
    if (/^product\/\d+$/.test(key)) {
      const id = Number(key.split("/")[1]);
      const product = publicProducts.find((p) => p.id === id);
      res.statusCode = product ? 200 : 404;
      res.end(
        JSON.stringify(
          product
            ? {
                ...product,
                ...(product.id === outOfStockId
                  ? { status: "OUT_OF_STOCK" }
                  : {}),
                images: demoResponses.images.filter((i) => i.product === id),
                attribute_values: demoResponses.attributes!.values.filter(
                  (v) => v.product === id,
                ),
                variants: demoResponses.variants
                  .filter((v) => v.product === id)
                  .map((v) => ({
                    ...v,
                    attribute_values: demoResponses.variantValues.filter(
                      (a) => a.variant === v.id,
                    ),
                  })),
              }
            : {},
        ),
      );
      return;
    }
    res.statusCode = key in fixtures ? 200 : 404;
    res.end(JSON.stringify(fixtures[key] ?? {}));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const reserve = createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>((resolve) => reserve.close(() => resolve()));
  origin = `http://127.0.0.1:${port}`;
  const runtimeEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DJANGO_API_ORIGIN: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`,
  };
  delete runtimeEnv.SIFAT_CATALOG_SOURCE;
  delete runtimeEnv.SIFAT_ADMIN_SOURCE;
  frontend = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: runtimeEnv,
      stdio: "ignore",
    },
  );
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${origin}/api/backend/v1/auth/me`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 20_000 },
    )
    .toBe(401);
});
test.afterAll(async () => {
  if (frontend && frontend.exitCode === null) {
    const exit = once(frontend, "exit");
    frontend.kill("SIGTERM");
    await exit;
  }
  if (upstream) {
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
test.beforeEach(() => {
  records.clear();
  writes.length = 0;
  reads.length = 0;
  listStatus = writeStatus = sessionStatus = 200;
  outOfStockId = null;
});

test("server pagination requests one page, commits filters once, preserves URL and restores browser history", async ({
  page,
}) => {
  await page.goto(`${origin}/catalog`);
  await expect(page.locator(".s-product-card")).toHaveCount(20);
  await expect(
    page
      .locator("#store-content")
      .getByText(`Найдено: ${publicProducts.length}`, { exact: true }),
  ).toBeVisible();
  expect(
    reads.filter((p) => p.startsWith("/api/v1/catalog/products/")),
  ).toHaveLength(1);
  const imageRead = reads.find((p) =>
    p.startsWith("/api/v1/catalog/product-image?"),
  );
  expect(imageRead).toBeDefined();
  const requestedImageIds = new URL(`http://stub${imageRead}`).searchParams
    .get("product_ids")!
    .split(",");
  expect(requestedImageIds).toEqual(
    publicProducts.slice(0, 20).map((p) => String(p.id)),
  );
  expect(
    reads.some((p) =>
      /product-variants|attribute-values|\/attributes\//.test(p),
    ),
  ).toBe(false);
  const firstName = await page
    .locator(".s-product-card h3")
    .first()
    .innerText();
  await page.getByRole("link", { name: "Далее", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(
    page
      .locator("#store-content")
      .getByText("Страница 2 из 3", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".s-product-card")).toHaveCount(20);
  expect(await page.locator(".s-product-card h3").first().innerText()).not.toBe(
    firstName,
  );
  await page.goBack();
  await expect(
    page
      .locator("#store-content")
      .getByText("Страница 1 из 3", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Далее", exact: true }).click();
  await expect(
    page
      .locator("#store-content")
      .getByText("Страница 2 из 3", { exact: true }),
  ).toBeVisible();
  const beforeTyping = reads.filter((p) =>
    p.startsWith("/api/v1/catalog/products/"),
  ).length;
  await page.getByLabel("Цена от", { exact: true }).first().fill("105");
  await page.getByLabel("Цена до", { exact: true }).first().fill("130");
  expect(
    reads.filter((p) => p.startsWith("/api/v1/catalog/products/")),
  ).toHaveLength(beforeTyping);
  await page
    .getByRole("button", { name: "Применить цену", exact: true })
    .first()
    .click();
  await expect(page).not.toHaveURL(/page=2/);
  await expect(
    page.locator("#store-content").getByText("Найдено: 26", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Далее", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".s-product-card")).toHaveCount(6);
  const last = new URL(
    `http://stub${reads.filter((p) => p.startsWith("/api/v1/catalog/products/")).at(-1)}`,
  );
  expect(Object.fromEntries(last.searchParams)).toMatchObject({
    page: "2",
    min_price: "105",
    max_price: "130",
  });
  await page.reload();
  await expect(
    page
      .locator("#store-content")
      .getByText("Страница 2 из 2", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/api-pagination-320.png" });
});

test("search finds a product outside page one; combined filters/order run on the server before slicing", async ({
  page,
}) => {
  await page.goto(`${origin}/catalog?page=3`);
  await expect(
    page
      .locator("#store-content")
      .getByText("Страница 3 из 3", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Поиск по коллекции", { exact: true }).fill("Стул 40");
  await page
    .locator(".s-search-form")
    .getByRole("button", { name: "Найти", exact: true })
    .click();
  await expect(
    page.locator("#store-content").getByText("Найдено: 1", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".s-product-card h3")).toHaveText(["Стул 40"]);
  await expect(page).not.toHaveURL(/page=/);
  const brand = String(publicProducts[0].brand),
    category = String(publicProducts[0].product_type_info.category);
  await page.goto(
    `${origin}/catalog?brand=${brand}&category=${category}&min=105&max=130&sort=price-desc&page=2`,
  );
  const expected = publicProducts
    .filter(
      (p) =>
        String(p.brand) === brand &&
        String(p.product_type_info.category) === category &&
        Number(p.base_price) >= 105 &&
        Number(p.base_price) <= 130,
    )
    .sort((a, b) => Number(b.base_price) - Number(a.base_price));
  await expect(
    page
      .locator("#store-content")
      .getByText(`Найдено: ${expected.length}`, { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".s-product-card h3")).toHaveText(
    expected.slice(20, 40).map((p) => p.name),
  );
  const last = new URL(
    `http://stub${reads.filter((p) => p.startsWith("/api/v1/catalog/products/")).at(-1)}`,
  );
  expect(Object.fromEntries(last.searchParams)).toMatchObject({
    page: "2",
    brand_id: brand,
    category_id: category,
    min_price: "105",
    max_price: "130",
    ordering: "-base_price",
  });
  await page.goto(`${origin}/search?q=${encodeURIComponent("Стул 40")}`);
  await expect(page.locator(".s-product-card h3")).toHaveText(["Стул 40"]);
  const selectedCategory = demoResponses.categories.find(
    (c) => String(c.id) === category,
  )!;
  await page.goto(
    `${origin}/categories/${selectedCategory.slug}?category=999&sort=price-asc`,
  );
  const categoryQuery = new URL(
    `http://stub${reads.filter((p) => p.startsWith("/api/v1/catalog/products/")).at(-1)}`,
  );
  expect(categoryQuery.searchParams.get("category_id")).toBe(category);
  await expect(page.locator(".s-product-card")).toHaveCount(20);
});

test("OUT_OF_STOCK is present on home/catalog/search/category and stays unavailable in detail despite positive variant stock", async ({
  page,
}) => {
  outOfStockId = 1;
  const product = publicProducts.find((p) => p.id === outOfStockId)!;
  const category = demoResponses.categories.find(
    (c) => c.id === product.product_type_info.category,
  )!;
  for (const path of [
    "/",
    "/catalog",
    `/search?q=${encodeURIComponent(product.name)}`,
    `/categories/${category.slug}`,
  ]) {
    await page.goto(`${origin}${path}`);
    const card = page.locator(".s-product-card").filter({
      has: page.getByRole("heading", { name: product.name, exact: true }),
    });
    await expect(card).toBeVisible();
    await expect(
      card.getByText("Сейчас нет в наличии", { exact: true }),
    ).toBeVisible();
  }
  await page.goto(`${origin}/products/1`);
  await expect(
    page.getByRole("heading", { name: product.name, exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".s-selected-summary")
      .getByText("Сейчас нет в наличии", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".s-selected-summary").getByText(/^В наличии/),
  ).toHaveCount(0);
});

test("home requests four products, categories request none, detail outside page one uses one ID request", async ({
  page,
}) => {
  await page.goto(origin);
  await expect(page.locator(".s-product-card")).toHaveCount(4);
  const homeRequests = reads.filter((p) =>
    p.startsWith("/api/v1/catalog/products/"),
  );
  expect(homeRequests).toHaveLength(1);
  expect(reads.some((p) => /\/brands\/|\/product-types\//.test(p))).toBe(false);
  expect(
    new URL(`http://stub${homeRequests[0]}`).searchParams.get("page_size"),
  ).toBe("4");
  reads.length = 0;
  await page.goto(`${origin}/categories`);
  expect(reads.some((p) => p.startsWith("/api/v1/catalog/products/"))).toBe(
    false,
  );
  reads.length = 0;
  await page.goto(`${origin}/products/139`);
  await expect(
    page.getByRole("heading", { name: "Стул 40", exact: true }),
  ).toBeVisible();
  expect(reads.filter((p) => p.startsWith("/api/v1/catalog/product/"))).toEqual(
    ["/api/v1/catalog/product/139/"],
  );
  expect(reads.some((p) => p.startsWith("/api/v1/catalog/products/"))).toBe(
    false,
  );
  await page.goto(`${origin}/products/999999`);
  await expect(
    page.getByRole("heading", { name: "Этот предмет ещё не нашёлся" }),
  ).toBeVisible();
});
async function login(page: Page, account = "account-a") {
  await page
    .context()
    .addCookies([
      { name: "sifat_access", value: account, url: origin, httpOnly: true },
    ]);
}

test("API guest must log in; old local api favorites are not sent to Django", async ({
  page,
}) => {
  await page.goto(`${origin}/favorites`);
  await expect(
    page.getByRole("heading", { name: "Войдите, чтобы открыть избранное" }),
  ).toBeVisible();
  await page.goto(`${origin}/catalog`);
  await expect(
    page.getByRole("link", { name: "Войти, чтобы сохранить: Кресло Orom" }),
  ).toHaveAttribute("href", "/auth/login");
  expect(writes).toEqual([]);
  const direct = await page.request.post(
    `${origin}/api/backend/v1/catalog/favorites`,
    { data: { product: 1 } },
  );
  expect(direct.status()).toBe(401);
  expect(records.size).toBe(0);
});
test("real API flow adds once, updates header/PDP/list, persists, and deletes Favorite ID", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${origin}/catalog`);
  const button = page.getByRole("button", {
    name: "В избранное: Кресло Orom",
    exact: true,
  });
  await expect(button).toBeEnabled();
  await button.evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
  });
  await expect(
    page.getByRole("button", {
      name: "Убрать из избранного: Кресло Orom",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("link", { name: "Избранное: 1", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([
    {
      method: "POST",
      path: "/api/v1/catalog/favorites/",
      body: { product: 1 },
    },
  ]);
  await page.goto(`${origin}/products/1`);
  await expect(
    page.getByRole("button", {
      name: "Убрать из избранного: Кресло Orom",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto(`${origin}/favorites`);
  await expect(page.locator(".s-product-card")).toHaveCount(1);
  await page.reload();
  await page
    .getByRole("button", {
      name: "Убрать из избранного: Кресло Orom",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Оставьте место любимому" }),
  ).toBeVisible();
  expect(writes.at(-1)).toEqual({
    method: "DELETE",
    path: "/api/v1/catalog/favorites/701/",
    body: null,
  });
});
test("API errors show retry, never an empty/local success; POST/DELETE failure preserves state", async ({
  page,
}) => {
  await login(page);
  listStatus = 503;
  await page.goto(`${origin}/favorites`);
  await expect(
    page.getByRole("heading", { name: "Не удалось загрузить избранное" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Оставьте место любимому" }),
  ).toHaveCount(0);
  listStatus = 200;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Оставьте место любимому" }),
  ).toBeVisible();
  await page.goto(`${origin}/catalog`);
  writeStatus = 400;
  await page
    .getByRole("button", { name: "В избранное: Кресло Orom", exact: true })
    .click();
  await expect(
    page.getByText("Изменение отклонено сервером", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "В избранное: Кресло Orom", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  // Simulate another device saving after our last GET: POST now returns 200.
  records.set("account-a", [favorite(881, 1)]);
  writeStatus = 200;
  await page
    .getByRole("button", { name: "В избранное: Кресло Orom", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Избранное: 1", exact: true }),
  ).toBeVisible();
  writeStatus = 403;
  await page
    .getByRole("button", {
      name: "Убрать из избранного: Кресло Orom",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Убрать из избранного: Кресло Orom",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(writes.at(-1)?.path).toBe("/api/v1/catalog/favorites/881/");
});
test("unpublished favorites remain removable and accounts do not share favorites", async ({
  page,
}) => {
  records.set("account-a", [favorite(902, 999)]);
  await login(page);
  await page.goto(`${origin}/favorites`);
  await expect(
    page.getByRole("heading", { name: "Товар #999 недоступен в каталоге" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", {
      name: "Удалить недоступный товар #999 из избранного",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Оставьте место любимому" }),
  ).toBeVisible();
  expect(writes.at(-1)?.path).toBe("/api/v1/catalog/favorites/902/");
  records.set("account-a", [favorite(701, 1)]);
  await page.reload();
  await expect(page.locator(".s-product-card")).toHaveCount(1);
  await login(page, "account-b");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Оставьте место любимому" }),
  ).toBeVisible();
  expect(records.get("account-a")).toHaveLength(1);
});
test("auth service error and expired favorites session are not presented as empty", async ({
  page,
}) => {
  await login(page);
  sessionStatus = 503;
  await page.goto(`${origin}/favorites`);
  await expect(
    page.getByRole("heading", { name: "Не удалось загрузить избранное" }),
  ).toBeVisible();
  sessionStatus = 200;
  listStatus = 401;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Войдите, чтобы открыть избранное" }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});
