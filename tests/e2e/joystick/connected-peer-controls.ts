import type { Page } from '@playwright/test';
import { expect } from '../support/journey-test';

export const connectedPeerControls = {
  async assertInitialState(page: Page) {
    await expect(page.getByLabel('Slide position')).toContainText('1 / 3');
    await expect(page.getByLabel('Presenter notes content')).toContainText(
      'Use this space to capture presenter notes',
    );
  },

  async exerciseSlideButtons(joystickPage: Page, presenterPage: Page) {
    await joystickPage.getByRole('button', { name: 'Go to slide 2: Close' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
    await joystickPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('1 / 3');
  },

  async exerciseSlideNavigation(joystickPage: Page, presenterPage: Page) {
    await joystickPage.getByRole('button', { name: 'Show slide navigation' }).click();
    const slideNavigation = joystickPage.getByRole('dialog', { name: 'Slide navigation' });
    await expect(slideNavigation.getByRole('button', { name: 'Go to slide 1: Slide 1' })).toBeVisible();
    await slideNavigation.getByRole('button', { name: 'Close slide navigation' }).click();
    await expect(slideNavigation).toBeHidden();
    await joystickPage.getByRole('button', { name: 'Show slide navigation' }).click();
    await joystickPage
      .getByRole('dialog', { name: 'Slide navigation' })
      .getByRole('button', { name: 'Go to slide 2: Close' })
      .click();

    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
  },

  async exerciseStreamGestures(joystickPage: Page, presenterPage: Page) {
    await expect(joystickPage.getByRole('button', { name: 'Presenter stream preview' })).toBeVisible();
    const streamPreview = joystickPage.getByRole('button', { name: 'Presenter stream preview' });
    await streamPreview.dispatchEvent('pointerdown', {
      clientX: 320,
      pointerType: 'touch',
    });
    await streamPreview.dispatchEvent('pointerup', {
      clientX: 220,
      pointerType: 'touch',
    });
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
    await expect(joystickPage.getByText('Presenter notes that are created will appear here')).toBeVisible();

    await streamPreview.dispatchEvent('pointerdown', {
      clientX: 320,
      pointerType: 'touch',
    });
    await streamPreview.dispatchEvent('pointerup', {
      clientX: 220,
      pointerType: 'touch',
    });
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('3 / 3');
  },

  async exerciseTimer(page: Page) {
    await page.getByRole('button', { name: 'Increase notes size' }).click();
    await page.getByRole('button', { name: 'Decrease notes size' }).click();
    await page.getByRole('button', { name: 'Pause timer' }).click();
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Reset timer' }).click();
    await expect(page.getByLabel('Presentation timer')).toContainText('00:00');
  },

  async resizePresenterNotes(page: Page) {
    const notesResizeHandle = page.getByRole('button', { name: 'Resize presenter notes' });
    const notesHeightBefore = await page
      .getByRole('main', { name: 'Presentation remote control' })
      .evaluate((element) => getComputedStyle(element).getPropertyValue('--joystick-stream-notes-height'));
    const resizeBox = await notesResizeHandle.boundingBox();
    expect(resizeBox).not.toBeNull();
    await page.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y + resizeBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox!.x + resizeBox!.width / 2, resizeBox!.y - 80);
    await page.mouse.up();
    await expect
      .poll(() =>
        page
          .getByRole('main', { name: 'Presentation remote control' })
          .evaluate((element) => getComputedStyle(element).getPropertyValue('--joystick-stream-notes-height')),
      )
      .not.toBe(notesHeightBefore);
  },

  async verifyReloadReconnect(joystickPage: Page, presenterPage: Page) {
    await joystickPage.reload();
    await expect(joystickPage.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
    await expect(joystickPage.getByLabel('Connected (1)')).toBeVisible({ timeout: 45_000 });
    await expect(joystickPage.getByLabel('Slide position')).toContainText('2 / 3');
    await joystickPage.getByRole('button', { name: 'Previous slide' }).click();
    await expect(presenterPage.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await expect(joystickPage.getByLabel('Slide position')).toContainText('1 / 3');
  },
};
