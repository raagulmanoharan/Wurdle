import { defineConfig, devices } from '@playwright/test';

/**
 * Device viewport sizes (CSS pixels) for iPhone and popular Android devices.
 * Sources: screensizechecker.com, Apple/Samsung/Google spec pages.
 */
export const MOBILE_DEVICE_VIEWPORTS = [
  // --- iPhones ---
  { name: 'iPhone SE (3rd gen)', width: 375, height: 667 },
  { name: 'iPhone 12 mini / 13 mini', width: 375, height: 812 },
  { name: 'iPhone 16 / 15 / 14 / 13 / 12', width: 390, height: 844 },
  { name: 'iPhone 16 Pro / 15 Pro / 14 Pro', width: 393, height: 852 },
  { name: 'iPhone 17 / 17 Pro', width: 402, height: 874 },
  { name: 'iPhone 17 Air', width: 420, height: 912 },
  { name: 'iPhone 16 Plus / 15 Plus / 14 Plus', width: 428, height: 926 },
  { name: 'iPhone 16 Pro Max / 15 Pro Max / 14 Pro Max', width: 430, height: 932 },
  { name: 'iPhone 17 Pro Max', width: 440, height: 956 },
  // --- Android: Samsung ---
  { name: 'Galaxy Z Fold6 (cover)', width: 323, height: 792 },
  { name: 'Galaxy S25 / S24 / S23 / S22 / S21', width: 360, height: 780 },
  { name: 'Galaxy S21', width: 360, height: 800 },
  { name: 'Galaxy S23+ / S22+ / S21+ / S21 Ultra', width: 384, height: 854 },
  { name: 'Galaxy Z Flip6', width: 393, height: 960 },
  { name: 'Galaxy S25 Ultra / S24 Ultra / S24+ / S25+', width: 412, height: 891 },
  { name: 'Galaxy S23 Ultra / S22 Ultra', width: 412, height: 915 },
  // --- Android: Google Pixel ---
  { name: 'Pixel 9 Pro / 10 Pro', width: 410, height: 914 },
  { name: 'Pixel 8 / 7 / 6 / 6 Pro', width: 412, height: 915 },
  { name: 'Pixel 8 Pro / 9 Pro XL / 10 Pro XL', width: 412, height: 921 },
  { name: 'Pixel 9 / 10', width: 412, height: 923 },
] as const;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
