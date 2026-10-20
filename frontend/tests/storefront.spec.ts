import { expect, test, type Page } from "@playwright/test";

const api = "**/api/backend/v1";
async function guest(page: Page) {
  await page.route(`${api}/auth/me`, (route) =>
    route.fulfill({
      status: 401,
      json: { detail: "Authentication credentials were not provided." },
    }),
  );
}

test("variant selection, guest favorites protection and contact summary replace checkout", async ({
  page,
}) => {
  await guest(page);
  const unimplementedRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/.*(orders|favorites|cart|checkout)/.test(request.url()))
      unimplementedRequests.push(request.url());
  });
  await page.goto("/products/macbook-air-m4");
  const selectedSku = page.locator("#store-content .s-selected-sku");
  await expect(selectedSku).toContainText("MBA-M4-16-256");
  await page.getByRole("button", { name: "512 GB", exact: true }).click();
  await expect(page.locator(".s-detail-price")).toContainText(/13\s?400/);
  await expect(page.locator(".s-detail-price del")).toContainText(/13\s?900/);
  await expect(page.locator(".s-selected-summary")).toContainText("7 шт.");
  await page.getByRole("button", { name: /24 GB/ }).click();
  await expect(page.getByRole("button", { name: /256 GB/ })).toBeDisabled();
  await expect(selectedSku).toContainText("MBA-M4-24-512");
  await expect(page.locator(".s-selected-summary")).toContainText(
    "Сейчас нет в наличии",
  );
  await page
    .getByRole("button", { name: "Связаться с магазином", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Обсудим детали" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Информация для менеджера")).toHaveValue(
    /MBA-M4-24-512/,
  );
  await expect(dialog.getByLabel("Информация для менеджера")).toHaveValue(
    /Сенсорный экран: Нет/,
  );
  await expect(dialog.getByRole("link", { name: /Позвонить/ })).toHaveAttribute(
    "href",
    "tel:777774104",
  );
  await expect(
    dialog.getByRole("link", { name: "Написать в Telegram" }),
  ).toHaveAttribute("href", "https://t.me/sifat_mebel_sklad");
  await expect(
    dialog.getByRole("link", { name: "Написать в WhatsApp" }),
  ).toHaveAttribute("href", "https://wa.me/992777774104");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Связаться с магазином", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Войти, чтобы сохранить: MacBook Air M4" }),
  ).toHaveAttribute("href", "/auth/login");
  await page.goto("/favorites");
  await expect(
    page.getByRole("heading", { name: "Войдите, чтобы открыть избранное" }),
  ).toBeVisible();
  await expect(page.locator(".s-product-card")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".s-product-card")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Корзина/ })).toHaveCount(0);
  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/contact$/);
  expect(unimplementedRequests).toEqual([]);
});

test("store contacts expose the supplied local phone and Telegram on mobile and desktop", async ({
  page,
}) => {
  await guest(page);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/contact");
    await expect(
      page.getByRole("link", { name: "777-77-41-04", exact: true }),
    ).toHaveAttribute("href", "tel:777774104");
    const telegram = page.getByRole("link", {
      name: "Telegram · @sifat_mebel_sklad",
    });
    await expect(telegram).toHaveAttribute(
      "href",
      "https://t.me/sifat_mebel_sklad",
    );
    await expect(telegram).toHaveAttribute("rel", "noopener noreferrer");
    const whatsapp = page.getByRole("link", { name: "Написать в WhatsApp" });
    await expect(whatsapp).toHaveAttribute(
      "href",
      "https://wa.me/992777774104",
    );
    await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});

test("Demo cannot bypass authentication or save local favorites even for signed-in users", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/catalog/favorites"))
      requests.push(request.method());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "sifat-commerce-demo-v1",
      JSON.stringify({ favorites: ["demo:1", "api:1"], cart: [], orders: [] }),
    ),
  );
  await guest(page);
  await page.goto("/catalog");
  await expect(
    page.getByRole("link", { name: "Войти, чтобы сохранить: Кресло Orom" }),
  ).toHaveAttribute("href", "/auth/login");
  await expect(
    page.getByRole("button", { name: /^Убрать из избранного:/ }),
  ).toHaveCount(0);
  await page.goto("/favorites");
  await expect(
    page.getByRole("heading", { name: "Войдите, чтобы открыть избранное" }),
  ).toBeVisible();
  await page.route(`${api}/auth/me`, (route) =>
    route.fulfill({
      json: {
        id: 13,
        email: "customer@example.test",
        first_name: "Саид",
        role: "USER",
      },
    }),
  );
  await page.goto("/catalog");
  const heart = page.getByRole("button", {
    name: "В избранное: Кресло Orom",
    exact: true,
  });
  await expect(heart).toHaveAttribute(
    "title",
    "Демонстрационный товар нельзя сохранить в реальное избранное.",
  );
  await expect(heart).toBeDisabled();
  await page.goto("/favorites");
  await expect(
    page.getByRole("heading", { name: "Открыта демонстрационная коллекция" }),
  ).toBeVisible();
  await expect(page.locator(".s-product-card")).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("search, category filtering, sorting, mobile drawer and focus restoration", async ({
  page,
}) => {
  await page.goto("/search?q=кресло");
  await expect(page.locator(".s-product-card")).toHaveCount(1);
  await page.getByLabel("Поиск по коллекции").fill("Несуществующий предмет");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.getByText("Пока ничего не нашлось")).toBeVisible();
  await page.goto("/catalog?sort=price-asc");
  await expect(page.locator(".s-product-card h3").first()).toHaveText(
    "Стол Davra",
  );
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Фильтры", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Цена до").pressSequentially("5000");
  await expect(dialog.getByLabel("Цена до")).toHaveValue("5000");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Только в наличии").check();
  await dialog.getByRole("button", { name: "Показать: 2" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".s-filter-toggle")).toBeFocused();
  await expect(page.locator(".s-product-card")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".s-product-card")).toHaveCount(2);
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("simplified catalog search, removable filter chips and mobile cards work together", async ({
  page,
}) => {
  await guest(page);
  await page.goto("/catalog");
  await expect(
    page.getByRole("heading", { name: "Каталог", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Поиск по коллекции")).toBeVisible();
  const sidebar = page.getByRole("complementary", { name: "Фильтры товаров" });
  await expect(sidebar.locator(".s-filter-details")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.goto("/catalog?type=1&brand=Sifat+Studio&max=5000");
  await expect(sidebar.locator(".s-filter-details")).toHaveAttribute(
    "open",
    "",
  );
  await page
    .getByRole("button", { name: "Убрать фильтр: До 5000", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.has("max")).toBe(false);
  expect(new URL(page.url()).searchParams.get("brand")).toBe("Sifat Studio");
  expect(new URL(page.url()).searchParams.get("type")).toBe("1");
  await page
    .getByRole("button", { name: "Убрать фильтр: Кресла", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.has("type")).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Убрать фильтр: Sifat Studio",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Поиск по коллекции").fill("кресло");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await expect(page.locator(".s-product-card")).toHaveCount(1);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/catalog");
  const card = page.locator(".s-product-card").first();
  expect((await card.boundingBox())?.width).toBeGreaterThan(240);
  await page.screenshot({
    path: "test-results/simple-catalog-320.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Поиск товаров", { exact: true }).fill("кресло");
  await page.getByRole("button", { name: "Найти товар", exact: true }).click();
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.locator(".s-product-card")).toHaveCount(1);
  await page.goto("/catalog");
  await page.screenshot({
    path: "test-results/simple-catalog-1440.png",
    fullPage: true,
  });
});

test("login after cached guest or service error reads the new session without editing auth screens", async ({
  page,
}) => {
  for (const status of [401, 503]) {
    let authenticated = false;
    let failedStatus = status;
    const user = {
      id: 91,
      email: "preview@example.test",
      first_name: "Фируз",
      last_name: "",
      role: "USER",
      is_email_verified: true,
    };
    await page.route(`${api}/auth/me`, (route) =>
      route.fulfill(
        authenticated
          ? { json: user }
          : {
              status: failedStatus,
              json: { detail: "Проверка сессии недоступна" },
            },
      ),
    );
    await page.route(`${api}/auth/login`, (route) => {
      authenticated = true;
      return route.fulfill({ json: { user } });
    });
    await page.route(`${api}/profile`, (route) =>
      route.fulfill({
        json: { ...user, phone_number: "", birth_date: null, avatar: null },
      }),
    );
    await page.goto("/account");
    await expect(
      page.getByRole("heading", {
        name:
          status === 401
            ? "Ваше личное пространство"
            : "Не удалось загрузить профиль",
        exact: true,
      }),
    ).toBeVisible();
    if (status === 503) {
      failedStatus = 401;
      await page
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
    }
    // Next Link preserves the root QueryClient: no full browser reload.
    await page
      .getByRole("link", { name: "Войти в аккаунт", exact: true })
      .click();
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await page.getByLabel("Пароль", { exact: true }).fill("Preview-only-123!");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByLabel("Имя", { exact: true })).toHaveValue("Фируз");
  }
});

test("profile and address forms use only existing contracts", async ({
  page,
}) => {
  const user = {
    id: 1,
    email: "customer@example.test",
    first_name: "Саид",
    last_name: "Рахмонов",
    role: "USER",
    is_email_verified: true,
  };
  await page.route(`${api}/auth/me`, (route) => route.fulfill({ json: user }));
  let profile = {
    ...user,
    phone_number: "+992900000000",
    avatar: null,
    birth_date: null as string | null,
    created_at: "2026-09-20",
    updated_at: "2026-09-20",
  };
  await page.route(`${api}/profile`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      expect(Object.keys(body).sort()).toEqual([
        "birth_date",
        "first_name",
        "last_name",
        "phone_number",
      ]);
      profile = { ...profile, ...body };
    }
    await route.fulfill({ json: profile });
  });
  const addresses: Record<string, unknown>[] = [];
  await page.route(`${api}/profile/addresses**`, async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      const body = route.request().postDataJSON();
      expect(body.city).toBe("Душанбе");
      expect(body.user).toBeUndefined();
      const address = { ...body, id: 20 };
      addresses.push(address);
      return route.fulfill({ status: 201, json: address });
    }
    if (method === "PATCH") {
      addresses[0] = { ...addresses[0], ...route.request().postDataJSON() };
      return route.fulfill({ json: addresses[0] });
    }
    if (method === "DELETE") {
      addresses.splice(0);
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: addresses });
  });
  await page.goto("/account");
  await page.getByLabel("Имя", { exact: true }).fill("Фарид");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByText("Изменения профиля сохранены")).toBeVisible();
  expect(profile.first_name).toBe("Фарид");
  await page.goto("/addresses");
  await page
    .getByRole("button", { name: "Добавить адрес", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Получатель").fill("Фарид Рахмонов");
  await dialog.getByLabel("Телефон", { exact: true }).fill("+992900000000");
  await dialog.getByLabel("Улица", { exact: true }).fill("Рудаки");
  await dialog.getByLabel("Дом", { exact: true }).fill("12");
  await dialog.getByLabel("Основной адрес").check();
  await dialog.getByRole("button", { name: "Сохранить адрес" }).click();
  await expect(page.locator(".s-address-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await dialog.getByLabel("Дом", { exact: true }).fill("14");
  await dialog.getByRole("button", { name: "Сохранить адрес" }).click();
  await expect(page.locator(".s-address-card")).toContainText("д. 14");
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Удалить адрес", exact: true })
    .click();
  await expect(page.locator(".s-address-card")).toHaveCount(0);
});

test("dynamic attribute filters survive reload and reset with product type", async ({
  page,
}) => {
  await page.goto("/catalog?type=1");
  const sidebar = page.getByRole("complementary", { name: "Фильтры товаров" });
  await sidebar
    .getByLabel("Материал каркаса")
    .selectOption("string:Массив ореха");
  await expect(page.locator(".s-product-card")).toHaveCount(1);
  await page.reload();
  await expect(sidebar.getByLabel("Материал каркаса")).toHaveValue(
    "string:Массив ореха",
  );
  expect(new URL(page.url()).searchParams.get("attr.1")).toBe(
    "string:Массив ореха",
  );
  await page.getByRole("button", { name: "Комоды", exact: true }).click();
  await expect(sidebar.getByLabel("Материал каркаса")).toHaveValue("");
  await sidebar.getByLabel("Плавное закрывание").selectOption("boolean:true");
  await expect(page.locator(".s-product-card")).toHaveCount(1);
  expect(new URL(page.url()).searchParams.has("attr.1")).toBe(false);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: /Фильтры/ }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Плавное закрывание"),
  ).toHaveValue("boolean:true");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сбросить фильтры" })
    .click();
  expect(new URL(page.url()).searchParams.has("attr.8")).toBe(false);
});

test("email code supports paste, middle deletion and real error shapes", async ({
  page,
}) => {
  await page.route(`${api}/auth/email-verify`, (route) => {
    const payload = route.request().postDataJSON();
    return payload.code === "123456"
      ? route.fulfill({ json: { message: "Email verified successfully" } })
      : route.fulfill({
          status: 400,
          json: { error: ["Wrong verification code"] },
        });
  });
  await page.route(`${api}/auth/resend-verification`, (route) =>
    route.fulfill({ json: { message: "Verification code send successfully" } }),
  );
  await page.goto("/auth/verify-email?email=test@example.com");
  await page.getByLabel("Цифра 1", { exact: true }).fill("123456");
  await page.getByLabel("Цифра 3", { exact: true }).press("Backspace");
  await expect(page.getByLabel("Цифра 4", { exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "Подтвердить email" }).click();
  await expect(page.getByText("Введите все шесть цифр кода")).toBeVisible();
  await page.getByLabel("Цифра 3", { exact: true }).fill("9");
  await page.getByRole("button", { name: "Подтвердить email" }).click();
  await expect(page.getByText("Неверный код подтверждения.")).toBeVisible();
  await page.getByRole("button", { name: "Отправить снова" }).click();
  await expect(page.getByText(/Новый код отправлен/)).toBeVisible();
  await page.getByLabel("Цифра 1", { exact: true }).evaluate((input) => {
    const data = new DataTransfer();
    data.setData("text/plain", "123456");
    input.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
    );
  });
  await page.getByRole("button", { name: "Подтвердить email" }).click();
  await expect(page.getByText("Email подтверждён.")).toBeVisible();
});

for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560]) {
  test(`responsive routes fit ${width}px`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    await guest(page);
    await page.setViewportSize({ width, height: 950 });
    for (const path of [
      "/",
      "/catalog",
      "/categories",
      "/categories/furniture",
      "/search?q=стол",
      "/products/sokin-sofa",
      "/favorites",
      "/products/macbook-air-m4",
      "/contact",
      "/account",
      "/addresses",
      "/does-not-exist",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/verify-email",
    ]) {
      await page.goto(path);
      await page.locator("main").first().waitFor();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `${path} at ${width}px`).toBe(false);
    }
    expect(runtimeErrors).toEqual([]);
  });
}

test("profile loading, service error and retry do not pretend the user is signed in", async ({
  page,
}) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let attempts = 0;
  await page.route(`${api}/auth/me`, async (route) => {
    attempts++;
    if (attempts === 1) {
      await pending;
      return route.fulfill({
        status: 503,
        json: { detail: "Сервис временно недоступен" },
      });
    }
    return route.fulfill({
      status: 401,
      json: { detail: "Authentication credentials were not provided." },
    });
  });
  await page.goto("/account");
  await expect(
    page.getByRole("status", { name: "Проверяем сессию" }),
  ).toBeVisible();
  release();
  await expect(page.getByText("Не удалось загрузить профиль")).toBeVisible();
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Войти в аккаунт", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Имя", { exact: true })).toHaveCount(0);
});

test("small phone gallery and sticky contact sheet fit and remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/products/orom-lounge");
  await page.getByRole("button", { name: "Следующая фотография" }).click();
  await expect(
    page.getByText(
      "Интерьерное настроение коллекции; не дополнительный ракурс товара.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Увеличить фотографию" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/products/macbook-air-m4");
  await page.getByRole("button", { name: /24 GB/ }).click();
  await page.screenshot({
    path: "test-results/product-mobile.png",
    fullPage: true,
  });
  await page
    .locator(".s-mobile-purchase")
    .getByRole("button", { name: "Связаться", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Обсудим детали" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Информация для менеджера")).toHaveValue(
    /MBA-M4-24-512/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/contact-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(
    page
      .locator(".s-mobile-purchase")
      .getByRole("button", { name: "Связаться", exact: true }),
  ).toBeFocused();
});

test("404, mobile drawer trap, reduced motion and previews", async ({
  page,
}) => {
  await page.goto("/does-not-exist");
  await expect(page.getByText("Немного не по адресу")).toBeVisible();
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.goto("/catalog");
  await page.screenshot({
    path: "test-results/catalog-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Открыть меню" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("dialog") !== null,
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Открыть меню" }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".s-photo").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
});
