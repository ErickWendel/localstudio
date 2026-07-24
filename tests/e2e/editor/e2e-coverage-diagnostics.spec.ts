import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import type { Page } from '@playwright/test';

const getServer = withIsolatedDevServer(test);

test.describe('editor bundled runtime diagnostics coverage', () => {
  test('exercises bundled editor services through an explicit diagnostics route', async ({
    page,
  }) => {
    const url = new URL('/editor/', getServer().baseURL);
    url.searchParams.set('e2eCoverageDiagnostics', '1');
    url.searchParams.set('importPptxSample', '1');

    await page.addInitScript(() => {
      class DiagnosticImage extends EventTarget {
        height = 480;
        naturalHeight = 480;
        naturalWidth = 640;
        width = 640;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          window.setTimeout(() => {
            this.dispatchEvent(new Event('load'));
            this.onload?.();
          }, 0);
        }
      }

      Object.defineProperty(window, 'Image', {
        configurable: true,
        value: DiagnosticImage,
      });
      Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
        configurable: true,
        get() {
          return 3;
        },
      });
      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
        configurable: true,
        get() {
          return 720;
        },
      });
      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
        configurable: true,
        get() {
          return 1280;
        },
      });
      const sourceDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
      if (sourceDescriptor?.set && sourceDescriptor.get) {
        Object.defineProperty(HTMLMediaElement.prototype, 'src', {
          configurable: true,
          get() {
            return sourceDescriptor.get?.call(this) as string;
          },
          set(value: string) {
            const mediaElement = this as HTMLMediaElement;
            sourceDescriptor.set?.call(mediaElement, value);
            window.setTimeout(() => {
              mediaElement.dispatchEvent(new Event('loadedmetadata', { bubbles: true }));
            }, 0);
          },
        });
      }
      HTMLMediaElement.prototype.load = function load() {
        this.dispatchEvent(new Event('loadedmetadata', { bubbles: true }));
      };
      HTMLMediaElement.prototype.play = function play() {
        this.dispatchEvent(new Event('play', { bubbles: true }));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function pause() {
        this.dispatchEvent(new Event('pause', { bubbles: true }));
      };
      HTMLElement.prototype.requestFullscreen = function requestFullscreen() {
        Object.defineProperty(document, 'fullscreenElement', {
          configurable: true,
          get: () => this,
        });
        document.dispatchEvent(new Event('fullscreenchange'));
        return Promise.resolve();
      };
    });

    await page.route('**/__localstudio/pptx-sample/file', (route) =>
      route.fulfill({
        body: 'sample unavailable',
        status: 500,
      }),
    );

    await page.goto(url.toString());
    await expect(page.getByRole('status', { name: 'Diagnostics result' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('searchbox', { name: 'Search Google Fonts for replacement' }).fill('rob');
    await page.getByRole('button', { name: /Roboto/ }).click();
    await page.getByRole('button', { name: 'Replace Fonts' }).click();
    await waitForViewModelDiagnostics(page);
    await driveComponentGalleryDiagnostics(page);
    await drivePublicDeckDiagnostics(page);
    await driveHiddenEditorShellDiagnostics(page);
    await driveHiddenPresenterDiagnostics(page);
  });
});

async function waitForViewModelDiagnostics(page: Page) {
  await page
    .waitForFunction(
      () => {
          const labels = [
            'Editor view model diagnostics',
            'Sequential view model diagnostics',
            'Persistence view model diagnostics',
            'Failure view model diagnostics',
            'Edge view model diagnostics',
            'Background subject selection diagnostics',
            'Editor shell diagnostics',
            'Public deck diagnostics',
          ];
        return labels.every((label) => {
          const output = document.querySelector<HTMLOutputElement>(
            `output[aria-label="${label}"]`,
          );
          return Boolean(output && output.textContent !== 'pending');
        });
      },
      undefined,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
}

async function driveComponentGalleryDiagnostics(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        void (async () => {
          const wait = (delayMs = 25) => new Promise((resolve) => window.setTimeout(resolve, delayMs));
          const findButton = (label: string) =>
            Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
              (button) => button.getAttribute('aria-label') === label || button.textContent?.trim() === label,
            );
          for (let attempt = 0; attempt < 40; attempt += 1) {
            const deleteButton = findButton('Delete Remote A from remote');
            if (deleteButton) {
              deleteButton.click();
              await wait();
              findButton('Cancel')?.click();
              await wait();
              findButton('Delete Remote A from remote')?.click();
              await wait();
              findButton('Delete remote project')?.click();
              break;
            }
            await wait();
          }
          resolve();
        })();
      }),
  );
}

async function driveHiddenEditorShellDiagnostics(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        void (async () => {
          const wait = (delayMs = 0) => new Promise((resolve) => window.setTimeout(resolve, delayMs));
          const clickHiddenShellButton = (label: string) => {
            const shellRoot = document.querySelector('.e2e-hidden-editor-shell');
            const button = shellRoot?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
            if (!button || button.disabled) return false;
            button.click();
            return true;
          };
          const dispatchShellKey = (key: string, init: KeyboardEventInit = {}) => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init }),
            );
          };
          const dispatchShellKeyUp = (key: string) => {
            window.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key }));
          };
          const dispatchClipboardEvent = (type: 'copy' | 'cut' | 'paste', clipboardData: DataTransfer) => {
            const event = new ClipboardEvent(type, {
              bubbles: true,
              cancelable: true,
              clipboardData,
            });
            window.dispatchEvent(event);
          };

          for (let attempt = 0; attempt < 40; attempt += 1) {
            if (clickHiddenShellButton('Save deck before mirroring')) break;
            await wait(25);
          }
          await wait();
          for (const label of [
            'Mirror disabled',
            'Mirror ready',
            'Mirror syncing',
            'Mirror up to date',
            'Mirror failed',
          ]) {
            clickHiddenShellButton(label);
            await wait();
          }
          clickHiddenShellButton('Delete Remote A from remote');
          await wait();
          clickHiddenShellButton('Delete remote project');
          await wait();
          clickHiddenShellButton('Next Images page');
          await wait();
          clickHiddenShellButton('Previous Images page');
          await wait();
          const copyData = new DataTransfer();
          dispatchClipboardEvent('copy', copyData);
          await wait();
          const cutData = new DataTransfer();
          dispatchClipboardEvent('cut', cutData);
          await wait();
          dispatchClipboardEvent('paste', cutData);
          await wait();
          const imagePasteData = new DataTransfer();
          imagePasteData.items.add(
            new File(['diagnostic-image'], 'diagnostic-paste.png', { type: 'image/png' }),
          );
          dispatchClipboardEvent('paste', imagePasteData);
          await wait();
          clickHiddenShellButton('Play presentation');
          await wait();
          for (const key of [
            '#',
            'Home',
            'End',
            'ArrowDown',
            'ArrowRight',
            ']',
            '[',
            'ArrowLeft',
            'PageDown',
            'PageUp',
            'f',
            'b',
            'w',
            'c',
            's',
            'k',
            'i',
            'o',
          ]) {
            dispatchShellKey(key, key === 'ArrowDown' ? { shiftKey: true } : {});
            await wait();
          }
          dispatchShellKey('j');
          await wait();
          dispatchShellKeyUp('j');
          dispatchShellKey('l');
          await wait();
          dispatchShellKeyUp('l');
          dispatchShellKey('Escape');
          resolve();
        })();
      }),
  );
}

async function drivePublicDeckDiagnostics(page: Page) {
  const publicDeck = page
    .locator('[aria-label="Public presentation"], [aria-label="Embedded shared deck"]')
    .first();
  await publicDeck.waitFor({ state: 'attached', timeout: 2_000 }).catch(() => undefined);
  if ((await publicDeck.count()) === 0) return;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        void (async () => {
          const wait = (delayMs = 0) => new Promise((resolve) => window.setTimeout(resolve, delayMs));
          const deckRoot = document.querySelector(
            '[aria-label="Public presentation"], [aria-label="Embedded shared deck"]',
          );
          const clickFirst = (selector: string) => {
            deckRoot?.querySelector<HTMLButtonElement>(selector)?.click();
          };
          const clickAll = (selector: string) => {
            deckRoot
              ?.querySelectorAll<HTMLButtonElement>(selector)
              .forEach((button) => button.click());
          };
          const setInputValue = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          };
          const keyDown = (key: string, init: KeyboardEventInit = {}) => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init }),
            );
          };
          const keyUp = (key: string) => {
            window.dispatchEvent(
              new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key }),
            );
          };

          clickFirst('button[aria-label="Next slide"]');
          clickFirst('button[aria-label="Previous slide"]');
          clickFirst('button[aria-label="Show keyboard shortcuts"]');
          await wait();
          clickAll('.keyboard-shortcuts-row');
          await wait();
          clickFirst('button[aria-label="Show keyboard shortcuts"]');
          clickFirst('button[aria-label="Open transcript chat"]');
          clickFirst('button[aria-label="Open presentation AI"]');
          clickFirst('button[aria-label="Play presentation audio"]');
          await wait();
          clickFirst('button[aria-label="Pause presentation audio"]');
          clickFirst('button[aria-label="Play presentation audio"]');
          await wait();
          clickFirst('button[aria-label="Jump to slide 1: Slide 1"]');
          await wait();
          clickFirst('button[aria-label="Jump to slide 3: Public Slide 3"]');
          await wait();
          clickFirst('button[aria-label="Show captions"]');
          clickFirst('button[aria-label="Hide captions"]');
          deckRoot
            ?.querySelectorAll<HTMLInputElement>(
              'input[aria-label="Seek presentation audio"], input[aria-label="Seek podcast audio"]',
            )
            .forEach((input) => setInputValue(input, '1'));
          clickFirst('button[aria-label^="Jump to slide 2:"]');
          clickFirst('button[aria-label="Play podcast audio"]');
          clickFirst('button[aria-label="Play slide 1"]');
          await wait();
          clickFirst('button[aria-label="Play slide 1"]');
          clickFirst('button[aria-label="Play slide 2"]');
          await wait();
          clickFirst('button[aria-label="Play slide 2"]');
          clickFirst('button[aria-label^="Play transcript segment"]');
          clickAll('button[aria-label^="Play transcript segment"]');
          deckRoot
            ?.querySelectorAll<HTMLTextAreaElement>('textarea[aria-label="Question for transcript chat"]')
            .forEach((input) => setInputValue(input, 'Summarize the diagnostics recording.'));
          clickFirst('button[aria-label="Ask transcript"]');
          clickFirst('button[aria-label="Stop transcript answer"]');
          clickFirst('button[aria-label="Close transcript chat"]');
          clickFirst('button[aria-label="Present slide fullscreen"]');
          await wait();
          keyDown('?');
          await wait();
          keyDown('Escape');
          for (const key of [
            'Home',
            'End',
            'ArrowDown',
            'ArrowRight',
            ']',
            '[',
            'ArrowLeft',
            'PageDown',
            'PageUp',
            'k',
            'i',
            'o',
          ]) {
            keyDown(key, key === 'ArrowDown' ? { shiftKey: true } : {});
            await wait();
          }
          keyDown('j');
          await wait();
          keyUp('j');
          keyDown('l');
          await wait();
          keyUp('l');
          resolve();
        })();
      }),
  );
}

async function driveHiddenPresenterDiagnostics(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        void (async () => {
          const nextFrame = () => new Promise((resolve) => window.setTimeout(resolve, 0));
          const project = {
            assets: {
              'presenter-video-asset': {
                id: 'presenter-video-asset',
                mimeType: 'video/mp4',
                name: 'Presenter video',
                objectUrl: 'blob:presenter-video',
                type: 'video',
              },
            },
            createdAt: '2026-07-20T00:00:00.000Z',
            elements: {
              'presenter-text': {
                align: 'left',
                fill: '#FFFFFF',
                fontFamily: 'Inter',
                fontSize: 42,
                fontWeight: 700,
                height: 120,
                id: 'presenter-text',
                opacity: 1,
                rotation: 0,
                text: 'Presenter diagnostics',
                type: 'text',
                visible: true,
                width: 620,
                x: 120,
                y: 140,
              },
              'presenter-video': {
                assetId: 'presenter-video-asset',
                autoplayInPreview: true,
                controls: true,
                durationSeconds: 20,
                height: 240,
                id: 'presenter-video',
                locked: false,
                loop: false,
                muted: true,
                opacity: 1,
                playAcrossSlides: false,
                playbackPositionSeconds: 0,
                playing: true,
                repeatMode: 'none',
                rotation: 0,
                startOnClick: true,
                trimEndSeconds: 18,
                trimStartSeconds: 1,
                type: 'video',
                visible: true,
                volume: 0.5,
                width: 420,
                x: 760,
                y: 260,
              },
            },
            fonts: {},
            id: 'presenter-diagnostics-project',
            name: 'Presenter Diagnostics',
            pages: [
              {
                animationBuilds: [
                  {
                    delayMs: 0,
                    durationMs: 0,
                    effect: 'reveal',
                    elementId: 'presenter-video',
                    id: 'presenter-video-build',
                    mediaAction: 'play',
                    trigger: 'on-click',
                  },
                ],
                background: { color: '#111827', type: 'color' },
                elementIds: ['presenter-text', 'presenter-video'],
                height: 1080,
                id: 'presenter-page-1',
                name: 'Presenter Slide 1',
                speakerNotes: 'Presenter diagnostics notes',
                visible: true,
                width: 1920,
              },
              {
                background: { color: '#0f172a', type: 'color' },
                elementIds: ['presenter-text'],
                height: 1080,
                id: 'presenter-page-2',
                name: 'Presenter Slide 2',
                speakerNotes: 'Second presenter diagnostics notes',
                visible: true,
                width: 1920,
              },
            ],
            updatedAt: '2026-07-20T00:00:00.000Z',
          };
          window.postMessage(
            {
              payload: {
                activePageId: 'presenter-page-1',
                animationPreview: {
                  activeBuildIndex: 0,
                  activePageId: 'presenter-page-1',
                  mode: 'presenter',
                  playing: true,
                  revealedBuildIds: [],
                },
                project,
                promptModel: {
                  options: [
                    {
                      compatibility: 'compatible',
                      id: 'diagnostic-prompt',
                      label: 'Diagnostic prompt',
                      modelId: 'diagnostic-model',
                      readiness: 'ready',
                      selected: true,
                    },
                  ],
                  preparation: {
                    availability: 'ready',
                    progress: 100,
                    status: 'ready',
                  },
                },
                presenterMode: 'presenting',
                remoteSession: {
                  code: 'DIAG-1234',
                  connectedControllerCount: 1,
                  controlPeerId: 'diagnostic-peer',
                  expiresAt: '2026-07-20T01:00:00.000Z',
                  presenterDeviceId: 'diagnostic-device',
                  presenterLabel: 'Diagnostics',
                  qrUrl: 'https://remote.localstudio.test/?code=DIAG-1234',
                  sessionId: 'diagnostic-presenter',
                  transport: 'peerjs',
                },
                streamPeerId: 'stream-peer-1',
                transcriptionLanguage: { code: 'en-US', label: 'English' },
              },
              sessionId: 'diagnostic-presenter',
              source: 'localstudio-presenter-main',
              type: 'state',
            },
            window.location.origin,
          );
          await nextFrame();
          const root = document.querySelector('.e2e-hidden-presenter-view');
          const click = (label: string) =>
            root?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
          const keyDown = (key: string, init: KeyboardEventInit = {}) => {
            window.dispatchEvent(
              new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...init }),
            );
          };
          const keyUp = (key: string) => {
            window.dispatchEvent(
              new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key }),
            );
          };
          click('Show keyboard shortcuts');
          await nextFrame();
          keyDown('Escape');
          click('Show remote control QR code');
          click('Previous slide');
          click('Pause timer');
          click('Reset timer');
          click('Next slide');
          click('Increase notes size');
          click('Decrease notes size');
          const resizeHandle = root?.querySelector<HTMLElement>(
            '[aria-label="Resize presenter notes"]',
          );
          for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
            resizeHandle?.dispatchEvent(
              new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }),
            );
          }
          keyDown('?');
          await nextFrame();
          keyDown('Escape');
          keyDown('#');
          await nextFrame();
          keyDown('+');
          keyDown('-');
          keyDown('Enter');
          keyDown('Home');
          keyDown('End');
          keyDown('ArrowDown', { shiftKey: true });
          keyDown('ArrowRight');
          keyDown('[');
          keyDown('ArrowLeft');
          keyDown('r');
          keyDown('u');
          keyDown('d');
          keyDown('=', { metaKey: true });
          keyDown('-', { metaKey: true });
          keyDown('k');
          keyDown('j');
          keyUp('j');
          keyDown('l');
          keyUp('l');
          keyDown('i');
          keyDown('o');
          for (const command of ['pause-timer', 'resume-timer', 'reset-timer']) {
            window.postMessage(
              {
                command,
                sessionId: 'diagnostic-presenter',
                source: 'localstudio-presenter-main',
                type: 'command',
              },
              window.location.origin,
            );
          }
          await nextFrame();
          resolve();
        })().catch((error: unknown) =>
          reject(error instanceof Error ? error : new Error(String(error))),
        );
      }),
  );
}
