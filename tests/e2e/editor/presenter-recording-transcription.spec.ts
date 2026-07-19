import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { presenterRouteStartup } from './presenter-route-startup';

const getServer = withIsolatedDevServer(test);

test.describe('editor presenter recording transcription journey', () => {
  test('shows microphone permission errors from presenter recording controls', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.reject(new Error('Microphone blocked for e2e')),
        },
      });
    });

    await presenterRouteStartup.open(page, getServer().baseURL);

    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByLabel('Presenter status')).toContainText('Microphone blocked for e2e', {
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeEnabled();

    const transientPopup = page
      .waitForEvent('popup', { timeout: 500 })
      .catch(() => undefined);
    await page.getByRole('button', { name: 'Open live transcription window' }).click();
    await expect(page.getByLabel('Presenter status')).toContainText('Microphone blocked for e2e', {
      timeout: 10_000,
    });
    const popup = await transientPopup;
    if (popup) {
      await expect.poll(() => popup.isClosed()).toBe(true);
    }
  });

  test('records presenter audio, streams transcript updates, and exposes saved audio playback', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (
        window as Window & { __LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES?: string[] }
      ).__LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES = [];

      class FakeWorker {
        onerror: ((event: ErrorEvent) => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;

        postMessage(message: { id?: string; language?: string; type?: string }) {
          const id = message.id ?? 'missing-id';
          if (message.type === 'preload') {
            window.setTimeout(() => {
              this.onmessage?.(
                new MessageEvent('message', {
                  data: {
                    details: { file: 'mock-asr.onnx', loaded: 1, total: 2 },
                    id,
                    progress: 0.5,
                    type: 'progress',
                  },
                }),
              );
              this.onmessage?.(new MessageEvent('message', { data: { id, type: 'result' } }));
            }, 5);
            return;
          }
          if (message.type === 'transcribe') {
            (
              window as Window & { __LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES?: string[] }
            ).__LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES?.push(message.language ?? 'auto');
            window.setTimeout(() => {
              this.onmessage?.(
                new MessageEvent('message', {
                  data: {
                    id,
                    text: 'The presenter is explaining',
                    type: 'partial',
                  },
                }),
              );
            }, 5);
            window.setTimeout(() => {
              this.onmessage?.(
                new MessageEvent('message', {
                  data: {
                    id,
                    text: 'The presenter is explaining the podcast playback chapter workflow.',
                    type: 'result',
                  },
                }),
              );
            }, 100);
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

      class FakeMediaRecorder extends EventTarget {
        static isTypeSupported(mimeType: string) {
          return mimeType === 'audio/webm;codecs=opus' || mimeType === 'audio/webm';
        }

        mimeType = 'audio/webm;codecs=opus';
        state: RecordingState = 'inactive';

        start() {
          this.state = 'recording';
          window.setTimeout(() => {
            if (this.state !== 'recording') return;
            this.dispatchEvent(
              new BlobEvent('dataavailable', {
                data: new Blob(['presenter-audio-chunk'], { type: this.mimeType }),
              }),
            );
          }, 25);
        }

        stop() {
          if (this.state === 'inactive') return;
          this.state = 'inactive';
          this.dispatchEvent(
            new BlobEvent('dataavailable', {
              data: new Blob(['presenter-audio-final'], { type: this.mimeType }),
            }),
          );
          window.setTimeout(() => this.dispatchEvent(new Event('stop')), 0);
        }
      }

      class FakeAudioContext {
        destination = {};

        close() {
          return Promise.resolve();
        }

        createGain() {
          return {
            connect: () => undefined,
            disconnect: () => undefined,
            gain: { value: 1 },
          };
        }

        createMediaStreamSource() {
          return {
            connect: () => undefined,
            disconnect: () => undefined,
          };
        }

        createScriptProcessor() {
          return {
            connect() {
              window.setTimeout(() => {
                this.onaudioprocess?.({
                  inputBuffer: {
                    getChannelData: () => new Float32Array([0.1, 0.2, 0.1, 0]),
                  },
                });
              }, 5);
            },
            disconnect: () => undefined,
            onaudioprocess: undefined as
              | ((event: { inputBuffer: { getChannelData: () => Float32Array } }) => void)
              | undefined,
          };
        }
      }

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.resolve(new MediaStream()),
        },
      });
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        value: FakeAudioContext,
      });
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: FakeMediaRecorder,
      });
      Object.defineProperty(window, 'Worker', {
        configurable: true,
        value: FakeWorker,
      });
    });

    await presenterRouteStartup.open(page, getServer().baseURL);
    await expect(page.getByRole('combobox', { name: 'Transcription language' })).toHaveValue('pt');
    await page.getByRole('combobox', { name: 'Transcription language' }).selectOption('en');

    const transcriptPopupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open live transcription window' }).click();
    const transcriptPage = await transcriptPopupPromise;
    await expect(transcriptPage.getByRole('main', { name: 'Live transcription' })).toBeVisible();

    await expect(page.getByLabel('Presenter status')).toContainText('Recording', {
      timeout: 10_000,
    });
    await expect(transcriptPage.getByRole('button', { name: 'Increase text size' })).toBeVisible();
    await expect(transcriptPage.getByLabel(/Transcription status recording/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(transcriptPage.locator('.presenter-transcript-current')).toContainText(
      'The presenter is explaining the podcast playback chapter workflow.',
      { timeout: 10_000 },
    );

    await page.getByRole('button', { name: 'Stop recording' }).click();
    await expect(page.getByLabel('Presenter status')).toContainText('Recording saved', {
      timeout: 10_000,
    });
    await expect(transcriptPage.getByLabel(/Transcription status saved/)).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByRole('region', { name: 'Presenter audio playback' })).toBeHidden();
    await expect(page.getByText('Podcast mode')).toBeHidden();

    const commandNames = await page.evaluate(
      () => window.__LOCALSTUDIO_E2E_PRESENTER__?.commands ?? [],
    );
    expect(commandNames).toContain('save-recording');
    const transcriptionLanguages = await page.evaluate(
      () =>
        (
          window as Window & { __LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES?: string[] }
        ).__LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES ?? [],
    );
    expect(transcriptionLanguages).toContain('en');
  });
});
