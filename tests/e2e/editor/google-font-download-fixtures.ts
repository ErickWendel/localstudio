import type { Page } from '@playwright/test';

export const googleFontDownloadFixtures = {
  async forceDownloadableFontPath(page: Page) {
    await page.addInitScript(() => {
      Object.defineProperty(document.fonts, 'check', {
        configurable: true,
        value: () => false,
      });
    });
  },

  async mockFailedDownload(page: Page) {
    await page.route('https://fonts.googleapis.com/**', async (route) => {
      await route.fulfill({
        contentType: 'text/css',
        headers: { 'access-control-allow-origin': '*' },
        body: `
          @font-face {
            font-family: 'Montserrat';
            font-style: normal;
            font-weight: 700;
            src: url(https://fonts.gstatic.com/s/montserrat/v30/e2e.ttf) format('truetype');
          }
        `,
      });
    });
    await page.route('https://fonts.gstatic.com/**', async (route) => {
      await route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        status: 503,
        body: 'Font fixture intentionally unavailable in E2E.',
      });
    });
  },

  async mockSuccessfulDownload(page: Page) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'FontFace', {
        configurable: true,
        value: class MockFontFace {
          constructor(
            readonly family: string,
            readonly source: string,
            readonly descriptors: FontFaceDescriptors,
          ) {}

          async load() {
            await Promise.resolve();
            return this;
          }
        },
      });
      Object.defineProperty(document.fonts, 'add', {
        configurable: true,
        value: () => undefined,
      });
    });
    await page.route('https://fonts.googleapis.com/**', async (route) => {
      await route.fulfill({
        contentType: 'text/css',
        headers: { 'access-control-allow-origin': '*' },
        body: `
          @font-face {
            font-family: 'Montserrat';
            font-style: normal;
            font-weight: 700;
            src: url(https://fonts.gstatic.com/s/montserrat/v31/montserrat-700.woff2) format('woff2');
          }
        `,
      });
    });
    await page.route('https://fonts.gstatic.com/**', async (route) => {
      await route.fulfill({
        body: Buffer.from('localstudio-e2e-woff2-fixture'),
        contentType: 'font/woff2',
        headers: { 'access-control-allow-origin': '*' },
      });
    });
  },
};
