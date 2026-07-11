import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { presenterRouteHarness } from '../support/presenter-route-harness';

const getServer = withIsolatedDevServer(test);

test.describe('editor routed presenter journey', () => {
  test('opens a routed presenter window and responds to editor state and timer commands', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 820 });
    await presenterRouteHarness.install(page);

    await page.goto(`${getServer().baseURL}/editor/?presenter=1&presenterSession=e2e-presenter`);
    await expect(page.getByRole('main', { name: 'Presenter view' })).toBeVisible();

    const introDismissButton = page.getByRole('button', { name: 'Got it' });
    if (await introDismissButton.isVisible().catch(() => false)) {
      await introDismissButton.click();
    }

    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await expect(page.getByLabel('Presenter status')).toContainText('Builds remaining: 1');
    await expect(page.getByLabel('Speaker notes')).toHaveValue('Open with the metric.');

    const notesResizer = page.getByRole('separator', { name: 'Resize presenter notes' });
    const notesWidthBefore = await notesResizer.getAttribute('aria-valuenow');
    await notesResizer.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(notesResizer).not.toHaveAttribute('aria-valuenow', notesWidthBefore ?? '');
    await page.keyboard.press('Home');
    await expect(notesResizer).toHaveAttribute('aria-valuenow', '280');
    await page.keyboard.press('End');

    const resizerBox = await notesResizer.boundingBox();
    expect(resizerBox).not.toBeNull();
    await page.mouse.move(resizerBox!.x + resizerBox!.width / 2, resizerBox!.y + 40);
    await page.mouse.down();
    await page.mouse.move(resizerBox!.x - 120, resizerBox!.y + 40);
    await page.mouse.up();

    await page.getByRole('button', { name: 'Pause timer' }).click();
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('resume-timer');
    });
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('pause-timer');
    });
    await expect(page.getByRole('button', { name: 'Resume timer' })).toBeVisible();
    await page.evaluate(() => {
      window.__LOCALSTUDIO_E2E_PRESENTER__?.sendCommand('reset-timer');
    });
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeVisible();

    await page.getByLabel('Speaker notes').fill('Presenter route edited notes');
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.notesFor('slide-1')))
      .toBe('Presenter route edited notes');

    await page.getByRole('button', { name: 'Show remote control QR code' }).click();
    await expect(page.getByRole('region', { name: 'Remote control this presentation' })).toBeVisible();
    await page.getByRole('main', { name: 'Presenter view' }).click({ position: { x: 24, y: 24 } });
    await expect(page.getByRole('region', { name: 'Remote control this presentation' })).toBeHidden();

    await page.getByRole('button', { name: 'Show keyboard shortcuts' }).click();
    await expect(page.getByRole('dialog', { name: 'Magic Shortcuts' })).toBeVisible();
    await page.getByRole('button', { name: 'Increase notes size' }).click();
    await page.getByRole('button', { name: 'Decrease notes size' }).click();
    await page.getByRole('button', { name: 'Scroll notes down' }).click();
    await page.getByRole('button', { name: 'Scroll notes up' }).click();
    await page.getByRole('button', { name: 'Close keyboard shortcuts' }).click();

    await page.keyboard.press('Shift+Digit3');
    const slideNavigator = page.getByRole('dialog', { name: 'Slide navigator' });
    await expect(slideNavigator).toBeVisible();
    await page.keyboard.press('Equal');
    await expect(slideNavigator.getByRole('option', { name: /Slide 2.*Visual proof/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await page.keyboard.press('Shift+Digit3');
    await slideNavigator.getByRole('option', { name: /Slide 3.*Close/ }).dblclick();
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
    await page.keyboard.press('Home');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 1 of 3');
    await page.keyboard.press('End');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');
    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.activePageId()))
      .toBe('slide-3');
    await page.getByRole('main', { name: 'Presenter view' }).click({ position: { x: 24, y: 24 } });
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 2 of 3');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.getByLabel('Presenter status')).toContainText('Current: Slide 3 of 3');

    await expect
      .poll(() => page.evaluate(() => window.__LOCALSTUDIO_E2E_PRESENTER__?.commands ?? []))
      .toEqual(
        expect.arrayContaining([
          'request-state',
          'resume-timer',
          'pause-timer',
          'update-notes:slide-1',
          'go-to-page:slide-2',
          'go-to-page:slide-3',
          'go-to-page:slide-1',
          'go-to-page:slide-3',
          'go-to-page:slide-2',
        ]),
      );
  });
});
