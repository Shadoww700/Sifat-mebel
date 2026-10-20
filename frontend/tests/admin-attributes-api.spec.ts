import { expect, test, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { demoResponses } from "../src/lib/commerce/mock/catalog";
import type { AdminRow } from "../src/lib/admin/resources";

// API-mode Next + isolated HTTP stub. Never writes to the owner's Django/DB.
test.describe.configure({ mode: "serial" });
let upstream: Server, frontend: ChildProcess, origin: string;
let tables: Record<string, AdminRow[]>;
let failLink = false;
const writes: {
  key: string;
  method: string;
  payload: Record<string, unknown>;
  id?: number;
}[] = [];
test.beforeAll(async () => {
  upstream = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    const path = new URL(req.url!, "http://stub").pathname;
    if (path === "/api/v1/auth/me/") {
      res.end(
        JSON.stringify({
          id: 71,
          role: "ADMIN",
          email: "catalog-admin@example.test",
          first_name: "Фарид",
        }),
      );
      return;
    }
    if (req.method === "OPTIONS") {
      res.end("{}");
      return;
    }
    const parts = path
      .replace("/api/v1/catalog/", "")
      .split("/")
      .filter(Boolean);
    const key = parts[0];
    if (req.method === "GET") {
      res.end(JSON.stringify(tables[key] ?? []));
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    const id = parts[1] ? Number(parts[1]) : undefined;
    writes.push({ key, method: req.method!, payload, ...(id ? { id } : {}) });
    if (key === "product-type-attributes" && failLink) {
      res.statusCode = 400;
      res.end(JSON.stringify({ attribute: ["Привязка временно отклонена"] }));
      return;
    }
    if (key.endsWith("attribute-values")) {
      const productId =
        key === "variant-attribute-values"
          ? tables["product-variants"].find((row) => row.id === payload.variant)
              ?.product
          : payload.product;
      const product = tables.products.find((row) => row.id === productId);
      const binding = tables["product-type-attributes"].find(
        (row) =>
          row.product_type === product?.product_type &&
          row.attribute === payload.attribute,
      );
      const attribute = tables.attributes.find(
        (row) => row.id === payload.attribute,
      );
      const expected = {
        TEXT: "value_text",
        NUMBER: "value_number",
        BOOLEAN: "value_boolean",
      }[String(attribute?.data_type)];
      if (
        !binding ||
        (key === "variant-attribute-values" &&
          binding.can_be_variant_option !== true) ||
        !expected ||
        payload[expected] == null ||
        Object.entries(payload).some(
          ([name, value]) =>
            name.startsWith("value_") && name !== expected && value !== null,
        )
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            attribute: ["Значение не соответствует схеме типа"],
          }),
        );
        return;
      }
    }
    const rows = tables[key] ?? [];
    const saved = {
      ...(id ? rows.find((row) => row.id === id) : {}),
      ...payload,
      id: id ?? Math.max(99, ...rows.map((row) => row.id)) + 1,
    };
    tables[key] = id
      ? rows.map((row) => (row.id === id ? saved : row))
      : [...rows, saved];
    res.statusCode = id ? 200 : 201;
    res.end(JSON.stringify(saved));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const reserve = createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>((resolve) => reserve.close(() => resolve()));
  origin = `http://127.0.0.1:${port}`;
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
      env: {
        ...process.env,
        DJANGO_API_ORIGIN: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`,
        SIFAT_CATALOG_SOURCE: "api",
        SIFAT_ADMIN_SOURCE: "api",
      },
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
    const exited = once(frontend, "exit");
    frontend.kill("SIGTERM");
    await exited;
  }
  if (upstream) {
    upstream.closeAllConnections();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
test.beforeEach(async ({ page }) => {
  const copy = (rows: { id: number }[]) => structuredClone(rows) as AdminRow[];
  tables = {
    products: copy(demoResponses.products),
    "product-types": copy(demoResponses.types),
    categories: copy(demoResponses.categories),
    brands: [{ id: 1, name: "Sifat Studio", is_active: true }],
    "product-image": copy(demoResponses.images),
    "product-variants": copy(demoResponses.variants),
    attributes: [],
    "product-type-attributes": [],
    "product-attribute-values": [],
    "variant-attribute-values": [],
  };
  failLink = false;
  writes.length = 0;
  await page
    .context()
    .addCookies([
      {
        name: "sifat_access",
        value: "isolated-admin",
        url: origin,
        httpOnly: true,
      },
    ]);
});
async function openSetup(page: Page, variant = false) {
  await page.goto(`${origin}/admin/products/1`);
  await page
    .getByRole("button", {
      name: variant ? "Опции вариантов" : "Характеристики",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Добавить атрибут и значение", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Атрибут и значение", exact: true });
}
test("empty schema: create TEXT/NUMBER/BOOLEAN definitions, bind type, save correct typed values", async ({
  page,
}) => {
  for (const [type, slug, value] of [
    ["TEXT", "frame", "Массив дуба"],
    ["NUMBER", "height", "0"],
    ["BOOLEAN", "adjustable", "false"],
  ]) {
    const dialog = await openSetup(page);
    await dialog
      .getByRole("button", { name: "Создать новый атрибут", exact: true })
      .click();
    await dialog
      .getByLabel("Название *", { exact: true })
      .fill(`Атрибут ${type}`);
    await dialog.getByLabel("Slug *", { exact: true }).fill(slug);
    await dialog
      .getByLabel("Тип значения *", { exact: true })
      .selectOption(type);
    await dialog
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await expect(
      dialog.getByText("Шаг 2 из 3 · Привязка к типу"),
    ).toBeVisible();
    await expect(
      dialog.getByLabel("Тип товара *", { exact: true }),
    ).toBeDisabled();
    await dialog.getByLabel("Доступна в фильтрах", { exact: true }).check();
    await dialog
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await expect(dialog.getByText("Шаг 3 из 3 · Значение")).toBeVisible();
    if (type === "BOOLEAN")
      await dialog
        .getByLabel("Логическое значение *", { exact: true })
        .selectOption(value);
    else
      await dialog
        .getByLabel(
          type === "NUMBER" ? "Числовое значение *" : "Текстовое значение *",
          { exact: true },
        )
        .fill(value);
    await dialog
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const last = writes.at(-1)!;
    expect(last.key).toBe("product-attribute-values");
    expect(last.payload).toMatchObject({
      product: 1,
      value_text: type === "TEXT" ? value : null,
      value_number: type === "NUMBER" ? "0" : null,
      value_boolean: type === "BOOLEAN" ? false : null,
    });
  }
  expect(writes.map((row) => row.key)).toEqual(
    Array(3)
      .fill([
        "attributes",
        "product-type-attributes",
        "product-attribute-values",
      ])
      .flat(),
  );
  await expect(page.locator(".a-table tbody tr")).toHaveCount(3);
});
test("existing value is PATCHed; variant workflow upgrades the existing binding, never duplicates it", async ({
  page,
}) => {
  tables.attributes = [
    {
      id: 9,
      name: "Регулировка",
      slug: "adjustable",
      data_type: "BOOLEAN",
      unit: "",
    },
  ];
  tables["product-type-attributes"] = [
    {
      id: 29,
      product_type: 1,
      attribute: 9,
      can_be_variant_option: false,
      is_required: false,
      is_filterable: false,
      sort_order: 0,
    },
  ];
  tables["product-attribute-values"] = [
    {
      id: 39,
      product: 1,
      attribute: 9,
      value_text: null,
      value_number: null,
      value_boolean: false,
    },
  ];
  let dialog = await openSetup(page);
  await dialog
    .getByLabel("Существующий атрибут", { exact: true })
    .selectOption("9");
  await dialog.getByRole("button", { name: "Продолжить с атрибутом" }).click();
  await expect(
    dialog.getByLabel("Логическое значение *", { exact: true }),
  ).toHaveValue("false");
  await dialog
    .getByLabel("Логическое значение *", { exact: true })
    .selectOption("true");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes[0]).toMatchObject({
    key: "product-attribute-values",
    method: "PATCH",
    id: 39,
  });
  dialog = await openSetup(page, true);
  await dialog
    .getByLabel("Существующий атрибут", { exact: true })
    .selectOption("9");
  await dialog.getByRole("button", { name: "Продолжить с атрибутом" }).click();
  await expect(
    dialog.getByLabel("Опция варианта", { exact: true }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await dialog
    .getByLabel("Логическое значение *", { exact: true })
    .selectOption("false");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes[1]).toMatchObject({
    key: "product-type-attributes",
    method: "PATCH",
    id: 29,
    payload: { can_be_variant_option: true },
  });
  expect(writes[2]).toMatchObject({
    key: "variant-attribute-values",
    method: "POST",
    payload: { variant: 11, attribute: 9, value_boolean: false },
  });
});
test("binding failure keeps the created definition, supports retry, and fits a 320px drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const dialog = await openSetup(page);
  await dialog.getByRole("button", { name: "Создать новый атрибут" }).click();
  await dialog.getByLabel("Название *", { exact: true }).fill("Высота сиденья");
  await dialog.getByLabel("Slug *", { exact: true }).fill("seat-height");
  await dialog
    .getByLabel("Тип значения *", { exact: true })
    .selectOption("NUMBER");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog.getByText("Шаг 2 из 3 · Привязка к типу")).toBeVisible();
  failLink = true;
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Привязка временно отклонена",
  );
  expect(tables.attributes).toHaveLength(1);
  failLink = false;
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await dialog.getByLabel("Числовое значение *", { exact: true }).fill("45");
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/attribute-value-320.png" });
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes.filter((row) => row.key === "attributes")).toHaveLength(1);
});
