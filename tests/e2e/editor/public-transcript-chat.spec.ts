import { PublicDeckPage } from '../pages/public-deck.page';
import { createSharePayload } from '../support/share-payload';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor public transcript chat journey', () => {
  test('keeps the public transcript icon clickable when no recording was shared', async ({ page }) => {
    await page.addInitScript(() => {
      class EmptyTranscriptWorker {
        onmessage: ((event: MessageEvent) => void) | null = null;

        postMessage(message: { id?: string }) {
          window.setTimeout(() => {
            this.onmessage?.(
              new MessageEvent('message', {
                data: { embeddings: [], id: message.id ?? 'missing-id', type: 'result' },
              }),
            );
          }, 5);
        }

        terminate() {
          this.onmessage = null;
        }
      }

      Object.defineProperty(window, 'Worker', {
        configurable: true,
        value: EmptyTranscriptWorker,
      });
    });

    const payload = createSharePayload();
    payload.project.recordings = {};

    await page.route('**/empty-transcript-share.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });

    const publicDeck = new PublicDeckPage(page, getServer().baseURL);
    const shareSrc = encodeURIComponent('http://localhost/empty-transcript-share.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(false);

    const transcriptButton = page.getByRole('button', { name: 'Open transcript chat' });
    await expect(transcriptButton).toBeEnabled();
    await transcriptButton.click();
    await expect(page.getByRole('complementary', { name: 'Transcript chat' })).toBeVisible();
    await expect(
      page.getByText('No presenter recording has been published with this deck.'),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Ask' }).click();
    await page
      .getByRole('textbox', { name: 'Question for transcript chat' })
      .fill('Is there a recording?');
    await page.getByRole('button', { name: 'Ask transcript' }).click();
    await expect(page.getByText('No transcript text is available for this presentation.')).toBeVisible();
  });

  test('surfaces transcript chat model failures in the public viewer', async ({ page }) => {
    await page.addInitScript(() => {
      class FailingWorker {
        onerror: ((event: ErrorEvent) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;

        postMessage(message: { id?: string; type?: string }) {
          const id = message.id ?? 'missing-id';
          window.setTimeout(() => {
            this.onmessage?.(
              new MessageEvent('message', {
                data: {
                  id,
                  message:
                    message.type === 'embed'
                      ? 'Transcript embeddings are unavailable in this browser.'
                      : 'Transcript answer generation failed.',
                  type: 'error',
                },
              }),
            );
          }, 5);
        }

        terminate() {
          this.onmessage = null;
          this.onerror = null;
        }
      }

      Object.defineProperty(window, 'Worker', {
        configurable: true,
        value: FailingWorker,
      });
    });

    const payload = createSharePayload();
    payload.project.recordings = {
      'failed-chat-recording': {
        id: 'failed-chat-recording',
        name: 'Failed chat recording',
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
        durationMs: 8_000,
        language: 'en',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'https://cdn.localstudio.test/recordings/failed-chat-recording.webm',
          storage: 'remote',
        },
        segments: [
          {
            id: 'failed-chat-segment',
            text: 'Transcript chat should show a clear setup failure.',
            startMs: 0,
            endMs: 8_000,
            final: true,
          },
        ],
      },
    };

    await page.route('**/failed-transcript-share.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });

    const publicDeck = new PublicDeckPage(page, getServer().baseURL);
    const shareSrc = encodeURIComponent('http://localhost/failed-transcript-share.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(false);

    await page.getByRole('button', { name: 'Open transcript chat' }).click();
    await page.getByRole('tab', { name: 'Ask' }).click();
    await page
      .getByRole('textbox', { name: 'Question for transcript chat' })
      .fill('Why did setup fail?');
    await page.getByRole('button', { name: 'Ask transcript' }).click();

    await expect(page.getByText('Transcript embeddings are unavailable in this browser.')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('answers public transcript questions with browser embeddings and cited timestamps', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        configurable: true,
        get() {
          return 30;
        },
      });
      HTMLMediaElement.prototype.play = function play() {
        this.dispatchEvent(new Event('play'));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function pause() {
        this.dispatchEvent(new Event('pause'));
      };

      class FakeWorker {
        onerror: ((event: ErrorEvent) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;

        postMessage(message: {
          id?: string;
          prompt?: unknown;
          texts?: string[];
          type?: string;
        }) {
          const id = message.id ?? 'missing-id';
          if (message.type === 'embed') {
            const embeddings = (message.texts ?? []).map((text) =>
              /podcast|chapter|jump/i.test(text) ? [1, 0, 0] : [0, 1, 0],
            );
            window.setTimeout(() => {
              this.onmessage?.(
                new MessageEvent('message', {
                  data: { embeddings, id, type: 'result' },
                }),
              );
            }, 5);
            return;
          }
          if (message.type === 'generate-text') {
            window.setTimeout(() => {
              this.onmessage?.(
                new MessageEvent('message', {
                  data: {
                    id,
                    result:
                      'The transcript says podcast mode uses slide chapters so viewers can jump to the right section.',
                    type: 'result',
                  },
                }),
              );
            }, 5);
            return;
          }
          window.setTimeout(() => {
            this.onmessage?.(new MessageEvent('message', { data: { id, type: 'result' } }));
          }, 5);
        }

        terminate() {
          this.onmessage = null;
          this.onerror = null;
        }
      }

      Object.defineProperty(window, 'Worker', {
        configurable: true,
        value: FakeWorker,
      });
    });

    const payload = createSharePayload();
    payload.project.recordings = {
      'public-recording': {
        id: 'public-recording',
        name: 'Public launch recording',
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
        durationMs: 30_000,
        language: 'en',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'https://cdn.localstudio.test/recordings/public-recording.webm',
          storage: 'remote',
        },
        segments: [
          {
            id: 'public-segment-1',
            text: 'Podcast mode uses slide chapters so viewers can jump to the right section.',
            startMs: 0,
            endMs: 12_000,
            final: true,
            pageId: 'page-1',
            pageIndex: 0,
            pageName: 'Opening',
          },
          {
            id: 'public-segment-2',
            text: 'The public deck keeps the transcript searchable alongside playback.',
            startMs: 12_000,
            endMs: 30_000,
            final: true,
            pageId: 'page-2',
            pageIndex: 1,
            pageName: 'Details',
          },
        ],
      },
    };

    await page.route('**/public-transcript-share.json', async (route) => {
      await route.fulfill({ contentType: 'application/json', json: payload });
    });

    const publicDeck = new PublicDeckPage(page, getServer().baseURL);
    const shareSrc = encodeURIComponent('http://localhost/public-transcript-share.json');
    await publicDeck.goto(`/editor/?share=e2e-share&src=${shareSrc}`);
    await publicDeck.expectReady(false);

    await page.getByRole('button', { name: 'Open transcript chat' }).click();
    await expect(page.getByRole('complementary', { name: 'Transcript chat' })).toBeVisible();
    const podcastPlayer = page.getByRole('region', { name: 'Podcast playback' });
    await expect(podcastPlayer).toBeVisible();
    await expect(podcastPlayer.getByText('Podcast mode')).toBeVisible();
    await expect(podcastPlayer.getByLabel('Podcast recording')).toHaveValue('public-recording');
    await podcastPlayer.getByRole('button', { name: 'Play podcast audio' }).click();
    await expect(podcastPlayer.getByRole('button', { name: 'Pause podcast audio' })).toBeVisible();
    await podcastPlayer.getByRole('button', { name: 'Jump to Closing' }).click();
    await expect(page.getByText('2 / 2')).toBeVisible();
    await expect(page.getByText('Podcast mode uses slide chapters')).toBeVisible();
    await expect(page.getByLabel('Public launch recording audio')).toBeVisible();

    await page.getByRole('tab', { name: 'Ask' }).click();
    await page
      .getByRole('textbox', { name: 'Question for transcript chat' })
      .fill('What did the speaker say about podcast chapters?');
    await page.getByRole('button', { name: 'Ask transcript' }).click();

    await expect(page.getByText('The transcript says podcast mode uses slide chapters')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('.public-transcript-answer span').first()).toHaveText('0:00');

    await page
      .getByRole('textbox', { name: 'Question for transcript chat' })
      .fill('How can viewers jump to sections?');
    await page.getByRole('textbox', { name: 'Question for transcript chat' }).press('Enter');
    await expect(page.getByText('The transcript says podcast mode uses slide chapters')).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('button', { name: 'Close transcript chat' }).click();
    await expect(page.getByRole('complementary', { name: 'Transcript chat' })).toBeHidden();
  });
});
