import type { Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export async function assertConnectedPeerInitialState(page: Page) {
  await expect(page.getByLabel('Slide position')).toContainText('1 / 3');
  await expect(page.getByLabel('Presenter notes content')).toContainText(
    'Use this space to capture presenter notes',
  );
}
