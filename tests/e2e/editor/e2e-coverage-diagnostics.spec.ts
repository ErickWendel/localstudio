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
    const diagnosticsResult = page.getByLabel('Diagnostics result');
    await expect(page.getByRole('status', { name: 'Diagnostics result' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('searchbox', { name: 'Search Google Fonts for replacement' }).fill('rob');
    await page.getByRole('button', { name: /Roboto/ }).click();
    await page.getByRole('button', { name: 'Replace Fonts' }).click();
    await page
      .getByRole('button', { name: 'Hide diagnostics panels' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByRole('main', { name: 'Public presentation' }).first()).toBeVisible();
    await driveHiddenPresenterDiagnostics(page);

    await expect(diagnosticsResult).toContainText('"generated":"nested assistant text"', {
      timeout: 25_000,
    });
    await expect(diagnosticsResult).toContainText('"selectedRecordings":["second"]');
  });
});

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
