import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { presenterRouteStartup } from './presenter-route-startup';

const getServer = withIsolatedDevServer(test);

test.describe('editor presenter recording transcription journey', () => {
  test.describe.configure({ mode: 'serial' });

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

      class FakeSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = '';
        maxAlternatives = 0;
        onend: (() => void) | null = null;
        onerror: ((event: { error?: string; message?: string }) => void) | null = null;
        onresult:
          | ((
              event: {
                resultIndex: number;
                results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
              },
            ) => void)
          | null = null;

        start() {
          (
            window as Window & { __LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES?: string[] }
          ).__LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES?.push(this.lang);
          (
            window as Window & { __LOCALSTUDIO_E2E_SPEECH_RECOGNITION__?: FakeSpeechRecognition }
          ).__LOCALSTUDIO_E2E_SPEECH_RECOGNITION__ = this;
          window.setTimeout(() => {
            this.emitResult([
              { text: 'The presenter is explaining', final: false },
            ]);
          }, 5);
        }

        stop() {
          window.setTimeout(() => this.onend?.(), 0);
        }

        abort() {
          window.setTimeout(() => this.onend?.(), 0);
        }

        emitResult(results: Array<{ text: string; final: boolean }>) {
          this.onresult?.({
            resultIndex: 0,
            results: results.map((result) => ({
              0: { transcript: result.text },
              isFinal: result.final,
            })),
          });
        }
      }

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: () => Promise.resolve(new MediaStream()),
        },
      });
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: FakeMediaRecorder,
      });
      Object.defineProperty(window, 'SpeechRecognition', {
        configurable: true,
        value: FakeSpeechRecognition,
      });
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        configurable: true,
        value: FakeSpeechRecognition,
      });
    });

    await presenterRouteStartup.open(page, getServer().baseURL);
    await expect(page.getByRole('combobox', { name: 'Transcription language' })).toHaveValue('pt');
    await page.getByRole('combobox', { name: 'Transcription language' }).selectOption('en');

    await page.getByRole('button', { name: 'Open live transcription window' }).click();
    await expect(page.getByLabel('Presenter status')).toContainText(/choose your microphone first/i, {
      timeout: 10_000,
    });
    await expect(page.getByRole('alert')).toContainText(/choose your microphone first/i);
    await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible({
      timeout: 10_000,
    });
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
      'The presenter is explaining',
      { timeout: 10_000 },
    );
    await page.evaluate(() => {
      (
        window as Window & {
          __LOCALSTUDIO_E2E_SPEECH_RECOGNITION__?: {
            emitResult(results: Array<{ text: string; final: boolean }>): void;
          };
        }
      ).__LOCALSTUDIO_E2E_SPEECH_RECOGNITION__?.emitResult([
        {
          text: 'The presenter is explaining the podcast playback chapter workflow.',
          final: true,
        },
      ]);
    });
    await expect(transcriptPage.locator('.presenter-transcript-current')).toContainText('Slide 1', {
      timeout: 10_000,
    });
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.getByText('Current: Slide 2 of 3')).toBeVisible({ timeout: 10_000 });
    await page.evaluate(() => {
      (
        window as Window & {
          __LOCALSTUDIO_E2E_SPEECH_RECOGNITION__?: {
            emitResult(results: Array<{ text: string; final: boolean }>): void;
          };
        }
      ).__LOCALSTUDIO_E2E_SPEECH_RECOGNITION__?.emitResult([
        {
          text: 'The presenter is explaining the podcast playback chapter workflow.',
          final: true,
        },
        {
          text: 'Continuing on the second slide with local audio playback.',
          final: true,
        },
      ]);
    });
    await expect(transcriptPage.locator('.presenter-transcript-current')).toContainText('Slide 2', {
      timeout: 10_000,
    });
    await expect(transcriptPage.locator('.presenter-transcript-current')).toContainText(
      'Continuing on the second slide with local audio playback.',
      { timeout: 10_000 },
    );
    await expect(transcriptPage.locator('.presenter-transcript-current')).not.toContainText(
      '[Slide 2] Continuing on the second slide with local audio playback.',
    );

    await transcriptPage.evaluate(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await transcriptPage.close();
    await expect(page.getByLabel('Presenter status')).toContainText('Recording saved', {
      timeout: 10_000,
    });

    await expect(page.getByRole('region', { name: 'Presenter audio playback' })).toBeHidden();
    await expect(page.getByText('Podcast mode')).toBeHidden();

    const commandNames = await page.evaluate(
      () => window.__LOCALSTUDIO_E2E_PRESENTER__?.commands ?? [],
    );
    expect(commandNames).toContain('save-recording');
    const savedRecordingSegments = await page.evaluate(
      () =>
        window.__LOCALSTUDIO_E2E_PRESENTER__?.messages.find(
          (message) => message.command === 'save-recording',
        )?.recording?.segments.map((segment) => segment.text) ?? [],
    );
    expect(savedRecordingSegments).toContain(
      '[Slide 1] The presenter is explaining the podcast playback chapter workflow.',
    );
    expect(savedRecordingSegments).toContain(
      '[Slide 2] Continuing on the second slide with local audio playback.',
    );
    const transcriptionLanguages = await page.evaluate(
      () =>
        (
          window as Window & { __LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES?: string[] }
        ).__LOCALSTUDIO_E2E_TRANSCRIPTION_LANGUAGES ?? [],
    );
    expect(transcriptionLanguages).toContain('en-US');
  });
});
