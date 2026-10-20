import { expect, test } from "@playwright/test";

function contrast(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const theme of ["day", "evening"] as const) {
  test(`final keyboard, touch and contrast checks in ${theme} theme`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "sifat-theme", value: theme, url: "http://127.0.0.1:3100" },
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const viewport of [
      { width: 320, height: 640 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      for (const control of await page
        .locator(".s-header .s-icon-button:visible")
        .all()) {
        const bounds = await control.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
      }
      for (const link of await page
        .locator(".s-footer-grid a:not(.s-logo)")
        .all()) {
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      // Use actual keyboard navigation, not programmatic focus alone.
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("link", { name: "Перейти к содержимому" }),
      ).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.locator("#store-content")).toBeFocused();
      await page.keyboard.press("Tab");
      const colors = await page.evaluate(() => {
        const focused = document.activeElement!;
        const surface = document.querySelector(".store")!;
        return {
          focus: getComputedStyle(focused).outlineColor,
          background: getComputedStyle(surface).backgroundColor,
          width: getComputedStyle(focused).outlineWidth,
        };
      });
      expect(parseFloat(colors.width)).toBeGreaterThanOrEqual(2);
      expect(contrast(colors.focus, colors.background)).toBeGreaterThanOrEqual(
        3,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const menu = page.getByRole("button", { name: "Открыть меню" });
      if (viewport.width >= 768) {
        await expect(
          page.getByRole("navigation", { name: "Основная навигация" }),
        ).toBeVisible();
        continue;
      }
      await menu.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(() =>
            Boolean(document.activeElement?.closest("dialog")),
          ),
        ).toBe(true);
      }
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
    }
    await page.setViewportSize({ width: 640, height: 360 });
    await page.goto("/catalog");
    const filters = page.getByRole("button", { name: /^Фильтры/ });
    await filters.click();
    const drawer = page.getByRole("dialog");
    expect((await drawer.boundingBox())!.height).toBeLessThanOrEqual(360);
    expect(
      await drawer.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(filters).toBeFocused();
  });

  test(`long content, missing photos and mobile image resolution in ${theme} theme`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "sifat-theme", value: theme, url: "http://127.0.0.1:3100" },
    ]);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/catalog");
    const card = page.locator("#store-content .s-product-card").first();
    const image = card.locator("img");
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((node) => (node as HTMLImageElement).complete))
      .toBe(true);
    const resolution = await image.evaluate((node) => {
      const img = node as HTMLImageElement;
      return {
        requested: Number(new URL(img.currentSrc).searchParams.get("w")),
        rendered: Math.ceil(img.getBoundingClientRect().width),
      };
    });
    expect(resolution.requested).toBeGreaterThanOrEqual(resolution.rendered);
    await card.locator("h3 a").evaluate((node) => {
      node.textContent =
        "Модульный диван для большой гостиной с дополнительными секциями и подлокотниками";
    });
    await card.locator(".s-price strong").evaluate((node) => {
      node.textContent = "от 999 999 999 сомони";
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.goto("/products/orom-lounge");
    await page.getByRole("button", { name: "Увеличить фотографию" }).click();
    const zoom = page.getByRole("dialog");
    await zoom.getByRole("heading").evaluate((node) => {
      node.textContent =
        "ДлинноеНазваниеМодульногоДиванаБезПробеловДляПроверкиПереносов";
    });
    expect(
      await zoom.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    const close = await zoom
      .getByRole("button", { name: "Закрыть", exact: true })
      .boundingBox();
    expect(close!.width).toBeGreaterThanOrEqual(44);
    await page.keyboard.press("Escape");
    await page.goto("/products/macbook-air-m4");
    await expect(
      page.getByRole("img", {
        name: /MacBook Air M4: фотография пока недоступна/,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Увеличить фотографию" }),
    ).toBeDisabled();
    await page.goto("/catalog?q=НетТакогоТовара");
    await expect(
      page.getByRole("heading", { name: "Пока ничего не нашлось" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Показать все предметы" }).click();
    await expect(page.locator("#store-content .s-product-card")).toHaveCount(5);
  });
}
