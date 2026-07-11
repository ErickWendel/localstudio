import type { Page } from '@playwright/test';

import { joystickTrustedPresenterRuntimeState } from './joystick-trusted-presenter-runtime-state';
import { joystickTrustedPresenterSignalingService } from './joystick-trusted-presenter-signaling-service';
import type { JoystickTrustedPresenterInstallConfig } from './joystick-trusted-presenter-types';

export const joystickTrustedPresenterRemoteRuntime = {
  async install(page: Page, config: JoystickTrustedPresenterInstallConfig): Promise<void> {
    await joystickTrustedPresenterRuntimeState.install(page, config);
    await joystickTrustedPresenterSignalingService.install(page, config);
  },
};
