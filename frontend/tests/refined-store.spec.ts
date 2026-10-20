import { expect, test } from "@playwright/test";

const user = {
  id: 72,
  email: "customer.with.a.long.address@example.test",
  first_name: "Фируз",
  last_name: "Рахмонов",
  role: "USER",
  is_email_verified: true,
};
const profile = {
  ...user,
  phone_number: "+992900000000",
  avatar: null,
  birth_date: null,
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
};
const address = {
  id: 22,
  title: "Дом в Душанбе",
  recipient_name: "Фируз Рахмонов",
  phone_number: "+992900000000",
  country: "Таджикистан",
  region: "Душанбе",
  city: "Душанбе",
  district: "",
  street: "Проспект Рудаки",
  house: "12",
  apartment: "7",
  landmark: "",
  postal_code: "",
  is_default: true,
  latitude: null,
  longitude: null,
  created_at: "2026-10-01",
  updated_at: "2026-10-01",
};

for (const theme of ["day", "evening"] as const) {
  test(`refined storefront and signed-in account fit small phones through ultrawide in ${theme} mode`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "sifat-theme", value: theme, url: "http://127.0.0.1:3100" },
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const writes: string[] = [];
    await page.route("**/api/backend/v1/**", async (route) => {
      const request = route.request();
      if (request.method() !== "GET")
        writes.push(`${request.method()} ${request.url()}`);
      const path = new URL(request.url()).pathname;
      if (path.endsWith("/auth/me")) return route.fulfill({ json: user });
      if (path.endsWith("/profile")) return route.fulfill({ json: profile });
      if (path.endsWith("/profile/addresses"))
        return route.fulfill({ json: [address] });
      return route.fulfill({
        status: 404,
        json: { detail: "Not available in this test" },
      });
    });
    const routes = [
      ["catalog", "/catalog"],
      ["search", "/search?q=Кресло"],
      ["product", "/products/orom-lounge"],
      ["favorites", "/favorites"],
      ["profile", "/account"],
      ["addresses", "/addresses"],
      ["contact", "/contact"],
    ];
    for (const width of [320, 390, 430, 768, 1024, 1440, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [name, route] of routes) {
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        const main = page.locator("#store-content");
        await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
        if (name === "profile") {
          await expect(main.getByLabel("Имя", { exact: true })).toHaveValue(
            "Фируз",
          );
          await expect(
            main.getByRole("button", { name: "Сохранить изменения" }),
          ).toBeVisible();
        }
        if (name === "addresses") {
          await expect(main.locator(".s-address-card")).toHaveCount(1);
          await main
            .getByRole("button", { name: "Изменить", exact: true })
            .click();
          const drawer = page.getByRole("dialog");
          await expect(drawer.getByLabel("Получатель")).toHaveValue(
            address.recipient_name,
          );
          await expect(drawer.getByLabel("Основной адрес")).toBeChecked();
          expect(
            await drawer.evaluate(
              (element) => element.scrollWidth <= element.clientWidth,
            ),
          ).toBe(true);
          await page.keyboard.press("Escape");
          await expect(
            main.getByRole("button", { name: "Изменить", exact: true }),
          ).toBeFocused();
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${name} overflows at ${width}px`,
        ).toBe(true);
        if ([390, 1440].includes(width))
          await page.screenshot({
            path: `test-results/refined-${name}-${theme}-${width}.png`,
          });
      }
    }
    expect(writes).toEqual([]);
    await page.goto("/products/sokin-sofa");
    const gallery = page.getByRole("region", { name: "Галерея товара" });
    await gallery
      .getByRole("button", { name: "Следующая фотография", exact: true })
      .click();
    await expect(
      gallery.getByRole("button", { name: /^Фотография 2:/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await gallery.getByRole("button", { name: "Увеличить фотографию" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      gallery.getByRole("button", { name: "Увеличить фотографию" }),
    ).toBeFocused();
  });
}
