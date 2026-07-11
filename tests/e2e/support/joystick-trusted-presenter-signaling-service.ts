import type { Page } from '@playwright/test';

import type { JoystickTrustedPresenterInstallConfig } from './joystick-trusted-presenter-types';

export const joystickTrustedPresenterSignalingService = {
  async install(page: Page, config: JoystickTrustedPresenterInstallConfig): Promise<void> {
    await page.addInitScript(({ sessions }) => {
      window.__LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__ = {
        connectController: (code: string) => {
          const session = sessions.find((item) => item.code === code);
          return session ? { ...session, connectedControllerCount: 2 } : undefined;
        },
        getPublishedState: () => window.__LOCALSTUDIO_E2E_JOYSTICK_RUNTIME__?.getState(),
        listSessions: () => sessions,
        lookupSession: (code: string) => sessions.find((session) => session.code === code),
        publishCommand: (_code, command) =>
          window.__LOCALSTUDIO_E2E_JOYSTICK_RUNTIME__?.publishCommand(command) ?? false,
      };
    }, config);
  },
};
