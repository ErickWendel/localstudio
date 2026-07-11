import type { Page } from '@playwright/test';

const joystickTrustedPresenterDeviceStorageConfig = {
  deviceId: 'trusted-presenter',
  storageKey: 'localstudio.joystick.trustedPresenterDeviceIds',
} as const;

export const joystickTrustedPresenterDeviceStorage = {
  async install(page: Page): Promise<void> {
    await page.addInitScript(({ deviceId, storageKey }) => {
      window.localStorage.setItem(storageKey, JSON.stringify([deviceId]));
    }, joystickTrustedPresenterDeviceStorageConfig);
  },
};
