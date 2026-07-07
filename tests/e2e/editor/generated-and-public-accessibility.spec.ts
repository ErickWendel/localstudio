import { EditorAppPage } from '../pages/editor-app.page';
import { PublicDeckPage } from '../pages/public-deck.page';
import { installMockAiProviders } from '../support/mock-ai';
import { createSharePayload } from '../support/share-payload';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('generated and public accessibility regression journeys', () => {
  test('keeps generated editor layers keyboard operable', async ({ page }) => {
    await installMockAiProviders(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Layout');
    const removeCreateImageMode = page.getByRole('button', { name: 'Remove Create image mode' });
    if (await removeCreateImageMode.isVisible().catch(() => false)) {
      await removeCreateImageMode.click();
    }
    await page
      .getByRole('textbox', { name: 'Slide structure prompt' })
      .fill('Create an accessible keyboard smoke test slide');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await editor.openTool('Layout');
    const generatedTitle = page.getByRole('button', { name: 'AI workflow validated', exact: true });
    await expect(generatedTitle).toBeVisible({ timeout: 30_000 });
    await generatedTitle.focus();
    await expect(generatedTitle).toBeFocused();
    await page.keyboard.press('Enter');

    await editor.openTool('Design');
    await page.getByRole('tablist', { name: 'Movie inspector sections' }).getByRole('tab', { name: 'Text' }).click();
    await expect(page.getByRole('textbox', { name: 'Selected text content' })).toHaveValue(
      'AI workflow validated',
    );
  });

  test('keeps public deck navigation keyboard operable', async ({ page }) => {
    const payload = createSharePayload();
    await page.route('**/e2e-accessible-share.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });

    const publicDeck = new PublicDeckPage(page, getServer().baseURL);
    const shareSrc = encodeURIComponent('http://localhost/e2e-accessible-share.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(false);

    const nextButton = page.getByRole('button', { name: 'Next slide' });
    await nextButton.focus();
    await expect(nextButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByText('2 / 2')).toBeVisible();

    const previousButton = page.getByRole('button', { name: 'Previous slide' });
    await previousButton.focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('1 / 2')).toBeVisible();
  });
});
