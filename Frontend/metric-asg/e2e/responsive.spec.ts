import { test, expect } from '@playwright/test';

const viewports = [320, 375, 390, 768, 1024, 1440];

const routes = [
  { name: 'home', path: '/home' },
  { name: 'login', path: '/login' },
  { name: 'signup', path: '/sing-up' },
];

for (const route of routes) {
  for (const width of viewports) {
    test(`${route.name} - ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({
        width,
        height: 900,
      });

      const response = await page.goto(route.path, {
        waitUntil: 'domcontentloaded',
      });

      expect(response, 'La navegación debe devolver una respuesta').not.toBeNull();
      expect(response!.status(), 'La página debe responder correctamente').toBeLessThan(400);

      await expect(page).toHaveURL(
        new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`)
      );

      await expect(page.locator('body')).toBeVisible();

      await page.evaluate(() => document.fonts.ready);

      const dimensions = await page.evaluate(() => {
        const root = document.documentElement;

        return {
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          overflow: Math.max(0, root.scrollWidth - root.clientWidth),
        };
      });

      console.log(
        `[responsive] ${route.path} | ${width}px | ` +
        `scrollWidth=${dimensions.scrollWidth}px | ` +
        `clientWidth=${dimensions.clientWidth}px | ` +
        `overflow=${dimensions.overflow}px`
      );

      await page.screenshot({
        path: testInfo.outputPath(`${route.name}-${width}px.png`),
        fullPage: true,
      });
    });
  }
}
