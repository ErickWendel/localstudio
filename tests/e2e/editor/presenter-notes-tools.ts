import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const presenterNotesTools = {
  async verify(presenterPage: Page): Promise<void> {
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 2');
    await expect(presenterPage.getByLabel('Speaker notes')).toHaveValue(
      'Remember to pause after the opening slide.',
    );
    await presenterPage.getByLabel('Speaker notes').fill('Presenter edited notes');
    await expect(presenterPage.getByLabel('Speaker notes')).toHaveValue('Presenter edited notes');
    await presenterPage.getByRole('button', { name: 'Pause timer' }).click();
    await expect(presenterPage.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await presenterPage.getByRole('button', { name: 'Reset timer' }).click();
    await presenterPage.getByRole('button', { name: 'Increase notes size' }).click();
    await presenterPage.getByRole('button', { name: 'Decrease notes size' }).click();
    const remoteControlButton = presenterPage.getByRole('button', {
      name: 'Show remote control QR code',
    });
    await expect(remoteControlButton).toBeVisible();
    if (await remoteControlButton.isEnabled()) {
      await remoteControlButton.click();
      await expect(
        presenterPage.getByRole('region', { name: 'Remote control this presentation' }),
      ).toBeVisible();
      await presenterPage.getByRole('main', { name: 'Presenter view' }).click({
        position: { x: 12, y: 12 },
      });
      await expect(
        presenterPage.getByRole('region', { name: 'Remote control this presentation' }),
      ).toBeHidden();
    }

    const notesResizer = presenterPage.getByRole('separator', { name: 'Resize presenter notes' });
    await notesResizer.focus();
    await presenterPage.keyboard.press('ArrowLeft');
    await presenterPage.keyboard.press('ArrowRight');
    await presenterPage.keyboard.press('Home');
    await presenterPage.keyboard.press('End');

    await presenterPage.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    await expect(presenterPage.getByRole('dialog', { name: 'Magic Shortcuts' })).toBeVisible();
    await presenterPage.getByRole('button', { name: 'Close keyboard shortcuts' }).click();
  },
};
