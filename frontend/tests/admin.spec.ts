import { expect, test, type Page } from "@playwright/test";
import { resourceKeys } from "../src/lib/admin/resources";
const base = "**/api/backend/v1";
async function session(page: Page, role = "ADMIN", staff = true) {
  await page.route(`${base}/auth/me`, (route) =>
    route.fulfill({
      json: {
        id: 71,
        email: "staff@example.test",
        first_name: "Фарид",
        last_name: "",
        role,
      },
    }),
  );
  await page.route(`${base}/catalog/stock/movements`, (route) => {
    expect(route.request().method()).toBe("OPTIONS");
    return route.fulfill({
      status: staff ? 200 : 403,
      json: staff
        ? { name: "Stock Movement List" }
        : { detail: "You do not have permission to perform this action." },
    });
  });
}

test("guest cannot mount an admin page or fetch management data", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend/v1/catalog"))
      requests.push(request.url());
  });
  await page.route(`${base}/auth/me`, (route) =>
    route.fulfill({ status: 401, json: { detail: "Unauthenticated" } }),
  );
  await page.goto("/admin/products");
  await expect(
    page.getByRole("heading", { name: "Войдите в аккаунт" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Создать/ })).toHaveCount(0);
  expect(requests).toEqual([]);
});

for (const role of ["USER", "ADMIN", "MANAGER"])
  test(`${role} without backend permission is denied even with spoofed local storage`, async ({
    page,
  }) => {
    await session(page, role, false);
    await page.addInitScript(() => {
      localStorage.setItem("role", "ADMIN");
      localStorage.setItem("is_staff", "true");
    });
    await page.goto("/admin/product-variants");
    await expect(
      page.getByRole("heading", { name: "Доступ ограничен" }),
    ).toBeVisible();
    await expect(page.locator(".a-sidebar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Создать/ })).toHaveCount(0);
  });

test("USER, inactive MANAGER and unknown roles are denied even if permission probe would succeed", async ({
  page,
}) => {
  const catalogRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/backend/v1/catalog"))
      catalogRequests.push(request.url());
  });
  for (const role of ["MANAGER", "USER", "UNRECOGNIZED"]) {
    await session(page, role, true);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Доступ ограничен" }),
    ).toBeVisible();
  }
  expect(catalogRequests).toEqual([]);
});

test("customer storefront has no management controls; profile entry follows actual staff permission", async ({
  page,
}) => {
  await session(page, "USER", false);
  await page.route(`${base}/profile`, (route) =>
    route.fulfill({
      json: {
        email: "customer@example.test",
        first_name: "Саид",
        last_name: "",
        phone_number: "",
        birth_date: null,
        avatar: null,
      },
    }),
  );
  for (const path of [
    "/",
    "/catalog",
    "/search",
    "/products/sokin-sofa",
    "/favorites",
    "/account",
    "/contact",
  ]) {
    await page.goto(path);
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Создать|Архивировать|Корректиров/ }),
    ).toHaveCount(0);
  }
  await session(page, "ADMIN", true);
  await page.goto("/account");
  await expect(
    page.getByRole("link", { name: "Управление магазином" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Управление магазином" }).click();
  await expect(page.locator(".s-header, .s-mobile-bar, .s-footer")).toHaveCount(
    0,
  );
});

test("demo CRUD stays isolated; category edits persist in tab and deletion needs confirmation", async ({
  page,
}) => {
  await session(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/backend/") &&
      ["POST", "PATCH", "DELETE"].includes(request.method())
    )
      writes.push(request.url());
  });
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Создать категорию" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog.getByLabel("Название *", { exact: true })).toBeFocused();
  await dialog.getByLabel("Название *", { exact: true }).fill("Освещение");
  await dialog.getByLabel("Slug *", { exact: true }).fill("lighting");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Изменить: Освещение", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Изменить: Освещение", exact: true })
    .click();
  await dialog.getByLabel("Название *", { exact: true }).fill("Свет для дома");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page
    .getByRole("button", { name: "Удалить: Свет для дома", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Удалить: Свет для дома", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Удалить: Свет для дома", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Подтвердить", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Удалить: Свет для дома", exact: true }),
  ).toHaveCount(0);
  expect(writes).toEqual([]);
});

test("ADMIN changed to USER before save blocks mutation and removes management UI", async ({
  page,
}) => {
  await session(page);
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "Создать категорию" }).click();
  await page.getByLabel("Название *", { exact: true }).fill("Не сохранять");
  await page.getByLabel("Slug *", { exact: true }).fill("denied");
  await session(page, "USER", true);
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Доступ ограничен" }),
  ).toBeVisible();
  await session(page);
  await page.goto("/admin/categories");
  await expect(page.getByText("Не сохранять", { exact: true })).toHaveCount(0);
});

test("attribute forms enforce type schema and boolean false; stock updates history exactly once", async ({
  page,
}) => {
  await session(page);
  await page.goto("/admin/variant-attribute-values");
  await page.getByRole("button", { name: "Создать значение варианта" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Вариант *", { exact: true }).selectOption("51");
  await expect(
    dialog.getByLabel("Характеристика *", { exact: true }).locator("option"),
  ).toHaveText(["Выберите…", "RAM · #9", "Storage · #10"]);
  await dialog
    .getByLabel("Характеристика *", { exact: true })
    .selectOption("9");
  await expect(
    dialog.getByLabel("Числовое значение *", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Текстовое значение", { exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/admin/product-attribute-values");
  await page
    .getByRole("button", { name: "Изменить: Запись #11", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Логическое значение *", { exact: true }),
  ).toHaveValue("false");
  await page.keyboard.press("Escape");
  await page.goto("/admin/stock-adjustments");
  await page.getByLabel("Вариант *", { exact: true }).selectOption("51");
  await page.getByLabel("Количество *", { exact: true }).fill("2");
  await page
    .getByLabel("Основание", { exact: true })
    .fill("Учебное поступление");
  await page.getByRole("button", { name: "Проверить корректировку" }).click();
  await dialog.getByRole("button", { name: "Провести операцию" }).dblclick();
  await expect(page.locator(".a-stock-summary > strong")).toHaveText("6 шт.");
  await page.getByRole("link", { name: /История движений/ }).click();
  await expect(page.locator(".a-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".a-table tbody")).toContainText(
    "Учебное поступление",
  );
  await expect(
    page.getByRole("button", { name: /Удалить|Изменить|Создать/ }),
  ).toHaveCount(0);
});

test("ADMIN creates a product through the UI, adds scoped photo and variant, then publishes", async ({
  page,
}) => {
  await session(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/api/backend/") &&
      ["POST", "PATCH", "DELETE"].includes(request.method())
    )
      writes.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("link", { name: "Открыть панель администратора" })
    .click();
  await page.getByRole("link", { name: "Добавить товар", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  await expect(
    page.getByRole("button", { name: "Фотографии", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Название *", { exact: true }).fill("Кресло Navruz");
  await page.getByLabel("Slug *", { exact: true }).fill("navruz-chair");
  await page.getByLabel("Тип товара *", { exact: true }).selectOption("1");
  await page.getByLabel("Бренд *", { exact: true }).selectOption("1");
  await page.getByLabel("Артикул *", { exact: true }).fill("NAVRUZ-001");
  await page
    .getByLabel("Краткое описание *", { exact: true })
    .fill("Кресло для гостиной");
  await page
    .getByLabel("Описание *", { exact: true })
    .fill("Мягкое кресло с деревянным каркасом.");
  await page.getByLabel("Базовая цена *", { exact: true }).fill("2500");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
  await expect(
    page.getByRole("heading", { name: "Кресло Navruz", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Не опубликован", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Фотографии", exact: true }).click();
  await expect(page.locator(".a-table tbody tr")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Создать изображение", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Товар *", { exact: true }).locator("option"),
  ).toHaveText(["Выберите…", /Кресло Navruz/]);
  await dialog.getByLabel("Фотография *", { exact: true }).setInputFiles({
    name: "navruz.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await dialog
    .getByLabel("Описание фотографии", { exact: true })
    .fill("Кресло Navruz, вид спереди");
  await dialog.getByLabel("Основное фото", { exact: true }).check();
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".a-table tbody tr")).toHaveCount(1);
  await expect(
    page.getByText("Основное фото выбрано", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Варианты", exact: true }).click();
  await page
    .getByRole("button", { name: "Создать вариант", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Товар *", { exact: true }).locator("option"),
  ).toHaveText(["Выберите…", /Кресло Navruz/]);
  await dialog
    .getByLabel("Название *", { exact: true })
    .fill("Натуральный орех");
  await dialog
    .getByLabel("Артикул варианта *", { exact: true })
    .fill("NAVRUZ-WALNUT");
  await dialog.getByLabel("Цена *", { exact: true }).fill("2500");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".a-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Характеристики", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Создать значение товара", exact: true })
    .click();
  await dialog
    .getByLabel("Характеристика *", { exact: true })
    .selectOption("1");
  await dialog.getByLabel("Текстовое значение *", { exact: true }).fill("Орех");
  await dialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".a-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Основное", exact: true }).click();
  await page.getByLabel("Статус", { exact: true }).selectOption("ACTIVE");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Опубликован", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Опубликован", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `test-results/product-workspace-${width}.png`,
    });
  }
});

test("customer and inactive MANAGER cannot open product creation or workspace", async ({
  page,
}) => {
  for (const role of ["USER", "MANAGER"]) {
    await session(page, role, true);
    for (const path of ["/admin/products/new", "/admin/products/1"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "Доступ ограничен" }),
      ).toBeVisible();
      await expect(page.getByLabel("Название *", { exact: true })).toHaveCount(
        0,
      );
    }
  }
});

test("collection edit actions require verified ADMIN and open the correct product", async ({
  page,
}) => {
  for (const role of ["USER", "MANAGER", "UNRECOGNIZED"]) {
    await session(page, role, true);
    await page.goto("/catalog");
    await expect(page.locator(".s-product-card").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Изменить товар:/ }),
    ).toHaveCount(0);
  }
  await session(page, "ADMIN", false);
  await page.goto("/catalog");
  await expect(
    page.getByRole("link", { name: /^Изменить товар:/ }),
  ).toHaveCount(0);
  await session(page);
  await page.goto("/catalog");
  const edit = page.getByRole("link", {
    name: "Изменить товар: Кресло Orom",
    exact: true,
  });
  await expect(edit).toHaveAttribute("href", "/admin/products/1");
  await edit.click();
  await expect(
    page.getByRole("heading", { name: "Кресло Orom", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Название *", { exact: true })).toHaveValue(
    "Кресло Orom",
  );
});

test("evening theme persists in SSR, works on mobile and admin, and leaves auth untouched", async ({
  page,
}) => {
  await session(page);
  await page.goto("/catalog");
  await expect(page.locator(".store")).toHaveAttribute("data-theme", "day");
  await page
    .getByRole("button", { name: "Включить вечерний режим", exact: true })
    .click();
  await expect(page.locator(".store")).toHaveAttribute("data-theme", "evening");
  await expect(
    page.getByRole("button", { name: "Включить дневной режим", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const colors = await page
    .locator(".s-product-card")
    .evaluateAll((cards) =>
      cards.map((card) => getComputedStyle(card).backgroundColor),
    );
  expect(new Set(colors).size).toBeGreaterThanOrEqual(3);
  const response = await page.request.get("/catalog");
  expect(await response.text()).toContain('data-theme="evening"');
  await page.reload();
  await expect(page.locator(".store")).toHaveAttribute("data-theme", "evening");
  for (const width of [320, 375, 390, 430, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/catalog",
      "/products/orom-lounge",
      "/admin",
      "/admin/products/1",
    ]) {
      await page.goto(path);
      await expect(page.locator(".store")).toHaveAttribute(
        "data-theme",
        "evening",
      );
      await expect(page.locator("main h1").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${path} at ${width}`,
      ).toBe(true);
      if (path === "/catalog" && [320, 1280].includes(width))
        await page.screenshot({
          path: `test-results/evening-catalog-${width}.png`,
          fullPage: true,
        });
    }
  }
  await page.goto("/auth/login");
  await expect(
    page.getByRole("button", { name: /Включить .* режим/ }),
  ).toHaveCount(0);
  await expect(page.locator('[data-theme="evening"]')).toHaveCount(0);
  await page.goto("/catalog");
  await page
    .getByRole("button", { name: "Включить дневной режим", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".store")).toHaveAttribute("data-theme", "day");
});

for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920])
  test(`admin routes and forms fit ${width}px`, async ({ page }) => {
    await session(page);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const path of [
      "/admin",
      ...resourceKeys.map((key) => `/admin/${key}`),
      "/admin/stock-adjustments",
      "/admin/products/new",
      "/admin/products/1",
    ]) {
      await page.goto(path);
      await page.locator("#admin-content h1").waitFor();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        path,
      ).toBe(true);
    }
    await page.goto("/admin/product-types");
    await page
      .getByRole("button", { name: "Создать тип товара", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Создать тип товара", exact: true }),
    ).toBeFocused();
    if (width === 320 || width === 1440)
      await page.screenshot({
        path: `test-results/admin-${width}.png`,
        fullPage: true,
      });
    if (width < 1024) {
      await page
        .getByRole("button", { name: "Открыть меню управления" })
        .click();
      for (let i = 0; i < 18; i++) {
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(() =>
            Boolean(document.activeElement?.closest("dialog")),
          ),
        ).toBe(true);
      }
      await page.keyboard.press("Escape");
    }
    expect(errors).toEqual([]);
  });
