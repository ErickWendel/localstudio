import { type Page } from '@playwright/test';

import { JoystickAppPage } from '../pages/joystick-app.page';
import { trustedReconnectCommandHistory } from './trusted-reconnect-command-history';
import { trustedReconnectDirectControls } from './trusted-reconnect-direct-controls';
import { trustedReconnectPresenterState } from './trusted-reconnect-presenter-state';
import { trustedReconnectSetup } from './trusted-reconnect-setup';
import { trustedReconnectSlideNavigation } from './trusted-reconnect-slide-navigation';
import { trustedReconnectTimerControls } from './trusted-reconnect-timer-controls';

export const trustedReconnectJourney = {
  async run(page: Page, baseURL: string): Promise<void> {
    await page.setViewportSize({ width: 390, height: 844 });
    await trustedReconnectSetup.installTrustedPresenter(page);

    const joystick = new JoystickAppPage(page, baseURL);
    await joystick.gotoRemote();

    await trustedReconnectPresenterState.verifyPresenterModeRequired(page);
    await trustedReconnectPresenterState.enterPresentingMode(page);

    const currentSlidePreview = page.getByLabel('Current slide preview');
    await trustedReconnectPresenterState.verifyConnected(page, currentSlidePreview);
    await trustedReconnectTimerControls.exercise(page);
    await trustedReconnectDirectControls.exercise(page, currentSlidePreview);
    await trustedReconnectSlideNavigation.exercise(page);
    await trustedReconnectCommandHistory.verify(page);
  },
};
