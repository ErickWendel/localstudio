import { type Page } from '@playwright/test';

export const presenterKeyboardFullscreenMock = {
  async install(page: Page): Promise<void> {
    await page.addInitScript(() => {
      let fullscreenElement: Element | null = null;
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
      });
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        configurable: true,
        value: () => {
          fullscreenElement = document.querySelector('[aria-label="Canvas workspace"]');
          document.dispatchEvent(new Event('fullscreenchange'));
          return Promise.resolve();
        },
      });
      Object.defineProperty(document, 'exitFullscreen', {
        configurable: true,
        value: () => {
          fullscreenElement = null;
          document.dispatchEvent(new Event('fullscreenchange'));
          return Promise.resolve();
        },
      });
    });
  },
};
