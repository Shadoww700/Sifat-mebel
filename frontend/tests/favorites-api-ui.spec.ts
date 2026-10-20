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
const records = new Map<string, FavoriteDTO[]>();
const writes: { method: string; path: string; body: unknown }[] = [];
const favorite = (id: number, product: number): FavoriteDTO => ({
  id,
  product,
  created_at: "2026-10-18T10:00:00Z",
});
test.beforeAll(async () => {
  upstream = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://stub").pathname;
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
  listStatus = writeStatus = sessionStatus = 200;
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
  await page.goto(`${origin}/products/orom-lounge`);
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
