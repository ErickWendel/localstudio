import { PublicDeckPage } from '../pages/public-deck.page';
import { createSharePayload } from '../support/share-payload';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('public deck chapter audio sync', () => {
  test('keeps timeline seeks, slide choices, and transcript clicks aligned with audio', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        configurable: true,
        get: () => 30,
      });
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
        configurable: true,
        get(this: HTMLMediaElement) {
          return !this.hasAttribute('data-playing');
        },
      });
      HTMLMediaElement.prototype.play = function play() {
        this.setAttribute('data-playing', 'true');
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function pause() {
        this.removeAttribute('data-playing');
        this.dispatchEvent(new Event('pause'));
      };
    });

    const payload = createSharePayload();
    payload.project.recordings = {
      recording: {
        id: 'recording',
        name: 'Recorded talk',
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
        durationMs: 30000,
        language: 'en',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'https://cdn.localstudio.test/recording.webm',
          storage: 'remote',
        },
        segments: [
          { id: 'one', text: 'Opening', startMs: 0, endMs: 10000, final: true, pageIndex: 0, pageName: 'Opening' },
          { id: 'two', text: 'Next chapter', startMs: 10000, endMs: 30000, final: true, pageIndex: 1, pageName: 'Closing' },
        ],
      },
    };
    await page.route('**/chapter-sync-share.json', (route) =>
      route.fulfill({ contentType: 'application/json', json: payload }),
    );
    const publicDeck = new PublicDeckPage(page, getServer().baseURL);
    await publicDeck.goto(`/editor/?share=e2e-share&src=${encodeURIComponent('http://localhost/chapter-sync-share.json')}`);
    await publicDeck.expectReady(false);
    const audio = page.locator('audio').first();

    const closingChapter = page.getByRole('button', { name: 'Jump to slide 2: Closing' });
    await closingChapter.hover();
    await closingChapter.locator('.public-deck-playback-chapter-preview').click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(10);
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);

    await audio.evaluate((element: HTMLAudioElement) => {
      element.currentTime = 2;
      element.dispatchEvent(new Event('timeupdate'));
    });
    await expect(page.getByText('1 / 2')).toBeVisible();

    await page.getByLabel('Seek presentation audio').fill('10');
    await expect(page.getByText('2 / 2')).toBeVisible();
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(10);

    await page.getByRole('button', { name: 'Open transcript chat' }).click();
    const transcriptPanel = page.getByRole('complementary', { name: 'Transcript chat' });
    const podcastAudio = page.locator('audio').nth(1);
    await transcriptPanel
      .getByRole('button', { name: 'Play transcript segment for slide 1 at 0:00' })
      .click();
    await expect(page.getByText('1 / 2')).toBeVisible();
    await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(0);
    await expect.poll(() => podcastAudio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);

    await transcriptPanel.getByRole('button', { name: 'Open slide 2: Closing' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await expect.poll(() => podcastAudio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBe(10);
    await expect.poll(() => podcastAudio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false);

  });
});
