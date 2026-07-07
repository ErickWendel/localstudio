import { PublicDeckPage } from '../pages/public-deck.page';
import { createSharePayload } from '../support/share-payload';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('public deck view journey', () => {
  test('views shared and embedded decks through mocked public payloads', async ({ page }) => {
    const server = getServer();
    const payload = createSharePayload();
    await page.route('**/e2e-share.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });
    await page.route('**/missing-share.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: { shareId: 'other' } });
    });

    const publicDeck = new PublicDeckPage(page, server.baseURL);
    const shareSrc = encodeURIComponent('http://localhost/e2e-share.json');
    const missingShareSrc = encodeURIComponent('http://localhost/missing-share.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(false);
    await expect(page.getByText('1 / 2')).toBeVisible();
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('1 / 2')).toBeVisible();

    await publicDeck.goto(`/editor/?embed=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(true);

    await publicDeck.goto(`/editor/?share=e2e-share&src=${missingShareSrc}`);
    await expect(page.getByRole('heading', { name: 'Deck not found' })).toBeVisible();
  });
});
