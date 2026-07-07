import { EditorAppPage } from '../pages/editor-app.page';
import { PublicDeckPage } from '../pages/public-deck.page';
import { createSharePayload } from '../support/share-payload';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor slide transition and public playback journey', () => {
  test('configures slide transitions in the editor', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Animate');
    await page.getByLabel('Slide transition effect').selectOption('reveal');
    await page.getByRole('spinbutton', { name: 'Slide transition duration' }).fill('2');
    await expect(page.getByLabel('Slide transition effect')).toHaveValue('reveal');
    await expect(page.getByRole('spinbutton', { name: 'Slide transition duration' })).toHaveValue('2');
    await page.getByLabel('Slide transition effect').selectOption('none');
    await expect(page.getByLabel('Slide transition effect')).toHaveValue('none');
    await expect(page.getByRole('slider', { name: 'Slide transition duration slider' })).toBeDisabled();
  });

  test('plays public deck click-triggered builds before advancing slides', async ({ page }) => {
    const payload = createSharePayload();
    payload.project.pages[0].transition = { effect: 'reveal', delayMs: 0 };
    payload.project.pages[0].animationBuilds = [
      {
        id: 'build-title-1',
        elementId: 'title-1',
        effect: 'fade',
        trigger: 'on-click',
        delayMs: 0,
      },
    ];
    await page.route('**/e2e-animated-share.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });

    const publicDeck = new PublicDeckPage(page, getServer().baseURL);
    const shareSrc = encodeURIComponent('http://localhost/e2e-animated-share.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(false);
    await expect(page.getByText('1 / 2')).toBeVisible();

    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(page.getByText('1 / 2')).toBeVisible();
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('1 / 2')).toBeVisible();
  });
});
