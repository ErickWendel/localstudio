import { PublicDeckPage } from '../pages/public-deck.page';
import { createSharePayload } from '../support/share-payload';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('public deck view journey', () => {
  test('views shared and embedded decks through mocked public payloads', async ({ page }) => {
    const server = getServer();
    const payload = createSharePayload();
    payload.project.recordings = {
      'e2e-recording': {
        id: 'e2e-recording',
        name: 'E2E presenter recording',
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
        durationMs: 2200,
        language: 'en',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'https://cdn.localstudio.test/recordings/e2e-recording.webm',
          storage: 'remote',
        },
        segments: [
          {
            id: 'segment-1',
            text: 'Transcript chat is available in the public viewer.',
            startMs: 0,
            endMs: 2200,
            final: true,
          },
        ],
      },
    };
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
    await page.getByRole('button', { name: 'Open transcript chat' }).click();
    await expect(page.getByRole('complementary', { name: 'Transcript chat' })).toBeVisible();
    await expect(page.getByText('Transcript chat is available in the public viewer.')).toBeVisible();

    await publicDeck.goto(`/editor/?embed=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(true);

    await publicDeck.goto(`/editor/?share=e2e-share&src=${missingShareSrc}`);
    await expect(page.getByRole('heading', { name: 'Deck not found' })).toBeVisible();
  });
});
