import { expect, test } from "@playwright/test";

for (const theme of ["day", "evening"] as const) {
  test(`home sections preserve category routes, product actions and contacts in ${theme} mode`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "sifat-theme", value: theme, url: "http://127.0.0.1:3100" },
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [320, 375, 430, 768, 1024, 1440, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const body = page.locator("#store-content .s-home-body");
      await expect(
        body.getByRole("navigation", { name: "Категории товаров" }),
      ).toBeVisible();
      const categoryLinks = body.locator(".s-home-category-links a");
      expect(await categoryLinks.count()).toBeGreaterThan(0);
      for (const link of await categoryLinks.all()) {
        await expect(link).toHaveAttribute("href", /^\/categories\/[^?]+$/);
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const cards = body.locator(".s-product-card");
      await expect(cards).toHaveCount(4);
      for (const card of await cards.all()) {
        const favorite = await card.locator(".s-favorite").boundingBox();
        expect(favorite!.width).toBeGreaterThanOrEqual(44);
        expect(favorite!.height).toBeGreaterThanOrEqual(44);
        const badgeLocator = card.locator(".s-badge");
        const badge = (await badgeLocator.count())
          ? await badgeLocator.boundingBox()
          : null;
        if (badge)
          expect(badge.x + badge.width).toBeLessThanOrEqual(favorite!.x);
        await expect(
          card.getByRole("link", { name: /^Подробнее о товаре:/ }),
        ).toHaveAttribute("href", /^\/products\//);
        await expect(card.locator(".s-price strong")).not.toBeEmpty();
      }
      const support = page.getByRole("region", {
        name: /Нужна помощь.*с выбором/,
      });
      await expect(
        support.getByRole("link", { name: "777-77-41-04" }),
      ).toHaveAttribute("href", "tel:777774104");
      const whatsapp = support.getByRole("link", {
        name: "Написать в WhatsApp",
      });
      await expect(whatsapp).toHaveAttribute(
        "href",
        "https://wa.me/992777774104",
      );
      await expect(whatsapp).toHaveAttribute("rel", "noopener noreferrer");
      await expect(
        support.getByRole("link", { name: "Все способы связи" }),
      ).toHaveAttribute("href", "/contact");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `overflow at ${width}px`,
      ).toBe(true);
      if ([375, 1440].includes(width)) {
        // Full-page screenshots do not trigger offscreen lazy images themselves.
        for (const image of await cards.locator("img").all()) {
          await image.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              image.evaluate((element) => {
                const img = element as HTMLImageElement;
                return img.complete && img.naturalWidth > 0;
              }),
            )
            .toBe(true);
        }
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({
          path: `test-results/home-stage2-${theme}-${width}.png`,
          fullPage: true,
        });
      }
    }
    const category = page
      .locator("#store-content .s-home-category-links a")
      .first();
    const name = (await category.locator("span").nth(1).innerText()).trim();
    await category.click();
    await expect(
      page.getByRole("heading", { level: 1, name, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".s-home-body")).toHaveCount(0);
  });
}
