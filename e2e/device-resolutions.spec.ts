/**
 * Responsiveness tests: verifies the app renders at each iPhone and Android viewport size.
 * One test per device — layout must be visible and key content in viewport.
 */
import { test, expect } from '@playwright/test';
import { MOBILE_DEVICE_VIEWPORTS } from '../playwright.config';

for (const device of MOBILE_DEVICE_VIEWPORTS) {
  test(`renders at ${device.name} (${device.width}x${device.height})`, async ({ page }) => {
    await page.setViewportSize({ width: device.width, height: device.height });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.waitForSelector('text=Wurdle', { timeout: 10000 });

    const heading = page.getByRole('heading', { name: 'Wurdle' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
    await expect(page.getByRole('button', { name: /Let's go/ })).toBeVisible();
  });
}
