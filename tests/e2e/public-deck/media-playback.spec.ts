import { readFile } from 'node:fs/promises';
import { PublicDeckPage } from '../pages/public-deck.page';
import { createSharePayload } from '../support/share-payload';
import { getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('public deck media playback journey', () => {
  test('renders and plays a shared deck video asset from the public viewer', async ({ page }) => {
    const server = getServer();
    const payload = createSharePayload();
    payload.project.assets['asset-public-video'] = {
      id: 'asset-public-video',
      mimeType: 'video/mp4',
      name: 'Big Buck Bunny public fixture',
      objectUrl: 'http://localhost/e2e-public-video.mp4',
      type: 'video',
    };
    payload.project.elements['video-public'] = {
      assetId: 'asset-public-video',
      autoplayInPreview: false,
      controls: true,
      height: 405,
      id: 'video-public',
      locked: false,
      loop: false,
      muted: true,
      opacity: 1,
      playAcrossSlides: false,
      playbackPositionSeconds: 0,
      playing: false,
      posterFrameSeconds: 0,
      repeatMode: 'none',
      rotation: 0,
      startOnClick: false,
      trimStartSeconds: 0,
      type: 'video',
      visible: true,
      volume: 0.5,
      width: 720,
      x: 600,
      y: 420,
    };
    payload.project.pages[0].elementIds.push('video-public');

    await page.route('**/e2e-share-with-video.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });
    await page.route('**/e2e-public-video.mp4', async (route) => {
      await route.fulfill({
        body: await readFile(getBigBuckBunnyMp4Fixture()),
        contentType: 'video/mp4',
      });
    });

    const publicDeck = new PublicDeckPage(page, server.baseURL);
    const shareSrc = encodeURIComponent('http://localhost/e2e-share-with-video.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(false);

    const video = page.locator('video[aria-label="Big Buck Bunny public fixture"]');
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('src', /e2e-public-video\.mp4/);
    await expect
      .poll(() =>
        video.evaluate((node: HTMLVideoElement) =>
          node.play().then(
            () => !node.paused,
            () => false,
          ),
        ),
      )
      .toBe(true);
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();
  });
});
