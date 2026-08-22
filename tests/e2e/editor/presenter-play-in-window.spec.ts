import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor presenter play in window', () => {
  test('opens presenter view and keeps audience playback windowed', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await page.getByRole('button', { name: 'Presentation play options' }).click();
    const presenterPagePromise = page.waitForEvent('popup');
    await page.getByRole('menuitem', { name: 'Play in window' }).click();
    const presenterPage = await presenterPagePromise;

    await expect(presenterPage.getByLabel('Presenter view')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Audience Window' })).toContainText(
      'start playback in this browser window',
    );
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(false);

    await page.getByRole('button', { name: 'Play in window' }).click();

    await expect(page.getByRole('dialog', { name: 'Audience Window' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toHaveClass(
      /workspace-column-windowed-presentation/,
    );
    await expect(page.getByTestId('slide-canvas-frame')).toHaveAttribute(
      'data-animation-preview-mode',
      'presenter',
    );
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(false);

    await page.mouse.move(400, 10);
    await expect(page.getByRole('tooltip')).toHaveText('Press Esc to exit full screen');

    await page.keyboard.press('Escape');

    await expect(page.getByRole('region', { name: 'Canvas workspace' })).not.toHaveClass(
      /workspace-column-windowed-presentation/,
    );
    await expect(page.getByRole('tooltip')).toBeHidden();
    await expect(page.getByTestId('slide-canvas-frame')).toHaveAttribute(
      'data-animation-preview-mode',
      'idle',
    );
    await expect.poll(() => presenterPage.isClosed()).toBe(true);
  });
});
