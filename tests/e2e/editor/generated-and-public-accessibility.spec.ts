import { readFile } from 'node:fs/promises';
import { EditorAppPage } from '../pages/editor-app.page';
import { PublicDeckPage } from '../pages/public-deck.page';
import { installMockAiProviders } from '../support/mock-ai';
import { createSharePayload } from '../support/share-payload';
import { createTinyPngFixture, getBigBuckBunnyMp4Fixture } from '../support/test-assets';
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

  test('keeps public deck navigation keyboard operable', async ({ page }, testInfo) => {
    const payload = createSharePayload();
    payload.project.assets['asset-accessible-video'] = {
      id: 'asset-accessible-video',
      mimeType: 'video/mp4',
      name: 'Accessible media clip',
      objectUrl: 'http://localhost/e2e-accessible-video.mp4',
      type: 'video',
    };
    payload.project.assets['asset-accessible-gif'] = {
      id: 'asset-accessible-gif',
      mimeType: 'image/gif',
      name: 'Accessible animated loop',
      objectUrl: 'http://localhost/e2e-accessible-loop.png',
      type: 'gif',
    };
    payload.project.elements['video-accessible'] = {
      assetId: 'asset-accessible-video',
      autoplayInPreview: false,
      controls: false,
      height: 180,
      id: 'video-accessible',
      locked: false,
      loop: false,
      muted: true,
      opacity: 1,
      playAcrossSlides: false,
      repeatMode: 'none',
      rotation: 0,
      startOnClick: false,
      trimStartSeconds: 0,
      type: 'video',
      visible: true,
      volume: 1,
      width: 320,
      x: 120,
      y: 220,
    };
    payload.project.elements['gif-accessible'] = {
      assetId: 'asset-accessible-gif',
      height: 120,
      id: 'gif-accessible',
      locked: false,
      opacity: 1,
      playing: true,
      rotation: 0,
      type: 'gif',
      visible: true,
      width: 160,
      x: 500,
      y: 220,
    };
    payload.project.pages[0].elementIds.push('video-accessible', 'gif-accessible');
    await page.route('**/e2e-accessible-share.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });
    await page.route('**/e2e-accessible-video.mp4', async (route) => {
      await route.fulfill({
        body: await readFile(getBigBuckBunnyMp4Fixture()),
        contentType: 'video/mp4',
      });
    });
    await page.route('**/e2e-accessible-loop.png', async (route) => {
      await route.fulfill({
        body: await readFile(await createTinyPngFixture(testInfo)),
        contentType: 'image/png',
      });
    });

    const publicDeck = new PublicDeckPage(page, getServer().baseURL);
    const shareSrc = encodeURIComponent('http://localhost/e2e-accessible-share.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(false);
    await expect(page.locator('video[aria-label="Accessible media clip"]')).toBeVisible();
    await expect(page.locator('img[aria-label="Accessible animated loop"]')).toBeVisible();

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
