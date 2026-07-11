import { type Page } from '@playwright/test';

import { joystickTrustedPresenterHarness } from '../support/joystick-trusted-presenter-harness';

export const trustedReconnectSetup = {
  async installTrustedPresenter(page: Page): Promise<void> {
    await joystickTrustedPresenterHarness.installTrustedPresenterRemote(page, {
      initialState: joystickTrustedPresenterHarness.createRemoteState('ready'),
      sessions: [
        joystickTrustedPresenterHarness.createSession({
          code: 'A1D1-2345',
          expiresAt: '2026-07-09T20:00:00.000Z',
          presenterDeviceId: 'trusted-presenter',
          presenterLabel: 'Old presenter display',
        }),
        joystickTrustedPresenterHarness.createSession({
          code: 'TRU5-7ED1',
          expiresAt: '2026-07-09T22:00:00.000Z',
          presenterDeviceId: 'trusted-presenter',
          presenterLabel: 'Studio laptop',
        }),
        joystickTrustedPresenterHarness.createSession({
          code: 'NEW1-2345',
          expiresAt: '2026-07-09T23:00:00.000Z',
          presenterDeviceId: 'untrusted-presenter',
          presenterLabel: 'Untrusted display',
        }),
      ],
    });
  },
};
