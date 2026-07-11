import type { Page } from '@playwright/test';

import { joystickTrustedPresenterDeviceStorage } from './joystick-trusted-presenter-device-storage';
import { joystickTrustedPresenterRemoteRuntime } from './joystick-trusted-presenter-remote-runtime';
import type { JoystickTrustedPresenterInstallConfig } from './joystick-trusted-presenter-types';

export const joystickTrustedPresenterRemote = {
  async install(page: Page, config: JoystickTrustedPresenterInstallConfig): Promise<void> {
    await joystickTrustedPresenterDeviceStorage.install(page);
    await joystickTrustedPresenterRemoteRuntime.install(page, config);
  },
};
