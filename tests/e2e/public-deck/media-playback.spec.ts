import { readFile } from 'node:fs/promises';
import { PublicDeckPage } from '../pages/public-deck.page';
import { createSharePayload } from '../support/share-payload';
import { createTinyPngFixture, getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('public deck media playback journey', () => {
  test('renders and plays a shared deck video asset from the public viewer', async ({
    page,
  }, testInfo) => {
    const server = getServer();
    const payload = createSharePayload();
    let releaseImagePreload!: () => void;
    const imagePreloadReady = new Promise<void>((resolve) => {
      releaseImagePreload = resolve;
    });
    payload.project.assets['asset-public-image'] = {
      id: 'asset-public-image',
      mimeType: 'image/png',
      name: 'Public preload proof',
      objectUrl: 'http://localhost/e2e-public-image.png',
      type: 'image',
    };
    payload.project.assets['asset-public-video'] = {
      id: 'asset-public-video',
      mimeType: 'video/mp4',
      name: 'Big Buck Bunny public fixture',
      objectUrl: 'http://localhost/e2e-public-video.mp4',
      type: 'video',
    };
    payload.project.assets['asset-public-gif'] = {
      id: 'asset-public-gif',
      mimeType: 'image/gif',
      name: 'Public animated loop',
      objectUrl: 'http://localhost/e2e-public-loop.png',
      type: 'gif',
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
    payload.project.elements['gif-public'] = {
      assetId: 'asset-public-gif',
      height: 180,
      id: 'gif-public',
      locked: false,
      opacity: 1,
      playing: true,
      rotation: 0,
      type: 'gif',
      visible: true,
      width: 240,
      x: 240,
      y: 420,
    };
    payload.project.elements['image-public'] = {
      assetId: 'asset-public-image',
      height: 180,
      id: 'image-public',
      locked: false,
      opacity: 1,
      rotation: 0,
      type: 'image',
      visible: true,
      width: 240,
      x: 120,
      y: 120,
    };
    payload.project.fonts = {
      preload: {
        family: 'Public Preload Font',
        fileName: 'public-preload.woff2',
        fontStyle: 'normal',
        fontWeight: 400,
        id: 'public-preload-font',
        mimeType: 'font/woff2',
        objectUrl: 'http://localhost/e2e-public-font.woff2',
        requestedFamily: 'Public Preload Font',
        source: 'uploaded',
        storage: 'remote',
      },
    };
    payload.project.pages[0].elementIds.push('image-public');
    payload.project.pages[1].elementIds.push('video-public', 'gif-public');

    await page.route('**/e2e-share-with-video.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });
    await page.route('**/e2e-public-image.png', async (route) => {
      await imagePreloadReady;
      await route.fulfill({
        body: await readFile(await createTinyPngFixture(testInfo)),
        contentType: 'image/png',
      });
    });
    await page.route('**/e2e-public-font.woff2', async (route) => {
      await route.fulfill({
        body: '',
        contentType: 'font/woff2',
      });
    });
    await page.route('**/e2e-public-video.mp4', async (route) => {
      await route.fulfill({
        body: await readFile(getBigBuckBunnyMp4Fixture()),
        contentType: 'video/mp4',
      });
    });
    await page.route('**/e2e-public-loop.png', async (route) => {
      await route.fulfill({
        body: await readFile(await createTinyPngFixture(testInfo)),
        contentType: 'image/png',
      });
    });

    const publicDeck = new PublicDeckPage(page, server.baseURL);
    const shareSrc = encodeURIComponent('http://localhost/e2e-share-with-video.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await expect(page.getByRole('region', { name: 'Preparing shared deck' })).toBeVisible();
    await expect(page.getByText('Loading deck...')).toHaveCount(0);
    await expect(page.getByText(/assets ready$/)).toBeVisible();
    releaseImagePreload();
    await publicDeck.expectReady(false);
    await expect(page.getByText('1 / 2')).toBeVisible();
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();

    await expect(page.locator('canvas')).toBeVisible();
    const video = page.locator('video[aria-label="Big Buck Bunny public fixture"]');
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('src', /e2e-public-video\.mp4/);
    const gif = page.locator('img[aria-label="Public animated loop"]');
    await expect(gif).toBeVisible();
    await expect(gif).toHaveAttribute('src', /e2e-public-loop\.png/);
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
  });
});
