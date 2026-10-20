import { expect, test } from "@playwright/test";

for (const theme of ["day", "evening"] as const) {
  test(`home intro stays readable, scoped and usable across viewports in ${theme} mode`, async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "sifat-theme", value: theme, url: "http://127.0.0.1:3100" },
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      const hero = page.getByRole("region", {
        name: "Мебель для вашего дома.",
      });
      await expect(hero).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const image = hero.getByRole("img");
      await expect(image).toHaveAttribute("src", /sifat-auth-interior\.png/);
      await expect
        .poll(() =>
          image.evaluate(
            (element) => (element as HTMLImageElement).naturalWidth,
          ),
        )
        .toBeGreaterThan(0);
      await expect(
        hero.getByRole("link", { name: "Смотреть каталог" }),
      ).toHaveAttribute("href", "/catalog");
      await expect(
        hero.getByRole("link", { name: "Помочь с выбором" }),
      ).toHaveAttribute("href", "/contact");
      const measurements = await hero.evaluate((element) => {
        const heading = element.querySelector("h1")!;
        const style = getComputedStyle(heading);
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          headingLines: [...heading.children].map(
            (line) =>
              line.getBoundingClientRect().height /
              parseFloat(style.lineHeight),
          ),
          touchTargets: [...element.querySelectorAll("a")].map(
            (link) => link.getBoundingClientRect().height,
          ),
          opacity: getComputedStyle(element).opacity,
        };
      });
      expect(measurements.overflow, `overflow at ${width}px`).toBe(false);
      for (const lines of measurements.headingLines)
        expect(lines, `heading wraps at ${width}px`).toBeLessThan(1.1);
      for (const height of measurements.touchTargets)
        expect(height).toBeGreaterThanOrEqual(44);
      expect(measurements.opacity).toBe("1");
      if ([375, 768, 1440].includes(width))
        await hero.screenshot({
          path: `test-results/home-intro-${theme}-${width}.png`,
        });
    }
    await page
      .getByRole("region", { name: "Мебель для вашего дома." })
      .getByRole("link", { name: "Смотреть каталог" })
      .click();
    await expect(page).toHaveURL(/\/catalog$/);
    await expect(page.locator(".s-home-intro")).toHaveCount(0);
    await page.goto("/auth/login");
    await expect(page.locator(".s-home-intro")).toHaveCount(0);
    await expect(page.locator(".store")).toHaveCount(0);
  });
}
