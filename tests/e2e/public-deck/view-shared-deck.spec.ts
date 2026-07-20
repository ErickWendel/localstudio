import { PublicDeckPage } from '../pages/public-deck.page';
import { createSharePayload } from '../support/share-payload';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('public deck view journey', () => {
  test('views shared and embedded decks through mocked public payloads', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        configurable: true,
        get() {
          return 2.2;
        },
      });
      HTMLMediaElement.prototype.play = function play() {
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function pause() {
        this.dispatchEvent(new Event('pause'));
      };
    });

    const server = getServer();
    const payload = createSharePayload();
    payload.project.pages.push({
      id: 'page-3',
      name: 'Appendix',
      width: 1920,
      height: 1080,
      background: { type: 'color', color: '#061716' },
      elementIds: ['title-3'],
    });
    payload.project.elements['title-3'] = {
      id: 'title-3',
      type: 'text',
      text: 'Shared deck appendix without audio',
      x: 260,
      y: 300,
      width: 1400,
      height: 180,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      fontFamily: 'Open Sans',
      fontSize: 68,
      fontWeight: 800,
      fill: '#FFFFFF',
      align: 'center',
    };
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
            endMs: 1100,
            final: true,
            pageIndex: 0,
            pageName: 'Opening',
          },
          {
            id: 'segment-2',
            text: 'The closing slide has its own audio chapter.',
            startMs: 1100,
            endMs: 2200,
            final: true,
            pageIndex: 1,
            pageName: 'Closing',
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
    await expect(page.getByText('1 / 3')).toBeVisible();
    await page.getByRole('button', { name: 'Next slide' }).click();
    await expect(page.getByText('2 / 3')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByText('1 / 3')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Presentation playback' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Jump to slide' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Jump to slide 1: Opening' })).toHaveAttribute(
      'style',
      /--public-deck-chapter-preview-left: 0px/,
    );
    await expect(page.getByRole('button', { name: 'Jump to slide 3: Appendix' })).toHaveAttribute(
      'style',
      /--public-deck-chapter-preview-left: 100%/,
    );
    await page.getByRole('button', { name: 'Open transcript chat' }).click();
    const transcriptPanel = page.getByRole('complementary', { name: 'Transcript chat' });
    await expect(transcriptPanel).toBeVisible();
    await expect(transcriptPanel.getByLabel('Presentation slides')).toBeVisible();
    await expect(transcriptPanel.getByRole('button', { name: 'Open slide 1: Opening' })).toBeVisible();
    await expect(transcriptPanel.getByRole('button', { name: 'Open slide 2: Closing' })).toBeVisible();
    await expect(transcriptPanel.getByRole('button', { name: 'Open slide 3: Appendix' })).toBeVisible();
    await transcriptPanel.getByRole('button', { name: 'Open slide 2: Closing' }).click();
    await expect(page.getByText('2 / 3')).toBeVisible();
    await transcriptPanel.getByRole('button', { name: 'Play slide 2' }).click();
    await expect(transcriptPanel.getByRole('button', { name: 'Pause slide 2' })).toBeVisible();
    await expect(page.getByText('2 / 3')).toBeVisible();
    await transcriptPanel.getByRole('button', { name: 'Open slide 1: Opening' }).click();
    await expect(page.getByText('1 / 3')).toBeVisible();
    await page.getByRole('button', { name: 'Show captions' }).click();
    await expect(page.locator('.public-deck-caption-overlay')).toHaveText(
      'Transcript chat is available in the public viewer.',
    );
    await expect(
      transcriptPanel.getByText('Transcript chat is available in the public viewer.'),
    ).toBeVisible();
    await page.locator('audio').first().evaluate((audio: HTMLAudioElement) => {
      audio.currentTime = 2.2;
      audio.dispatchEvent(new Event('timeupdate'));
    });
    await expect(page.locator('.public-deck-playback-progress')).toHaveAttribute(
      'style',
      /--public-deck-progress: 50%/,
    );
    await transcriptPanel.getByRole('button', { name: 'Open slide 3: Appendix' }).click();
    await expect(page.getByText('3 / 3')).toBeVisible();
    await expect(page.locator('.public-deck-caption-overlay')).toBeHidden();
    await transcriptPanel
      .getByRole('button', { name: 'Play transcript segment for slide 2 at 0:01' })
      .click();
    await expect(page.getByText('2 / 3')).toBeVisible();
    await expect(transcriptPanel.getByRole('button', { name: 'Pause podcast audio' })).toBeVisible();
    await expect(transcriptPanel.getByRole('tab', { name: 'Ask' })).toBeHidden();
    await expect(transcriptPanel.getByRole('form', { name: 'Transcript question prompt' })).toBeVisible();
    await expect(
      transcriptPanel.getByRole('button', { name: 'Summarize this presentation in 3 bullets' }),
    ).toBeVisible();

    await publicDeck.goto(`/editor/?embed=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(true);

    await publicDeck.goto(`/editor/?share=e2e-share&src=${missingShareSrc}`);
    await expect(page.getByRole('heading', { name: 'Deck not found' })).toBeVisible();
  });
});
