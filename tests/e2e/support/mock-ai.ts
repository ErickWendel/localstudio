import type { Page } from '@playwright/test';

const generatedImagePng = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0,
  0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156,
  99, 248, 207, 192, 240, 31, 0, 5, 0, 1, 255, 137, 153, 61, 29, 0, 0, 0, 0,
  73, 69, 78, 68, 174, 66, 96, 130,
]);

export async function installMockAiProviders(page: Page) {
  await page.addInitScript((pngBytes) => {
    const slideTasks = JSON.stringify({
      language: 'en',
      page: {
        name: 'AI generated slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        { type: 'set-background', color: '#050D10' },
        {
          type: 'add-title',
          id: 'ai-title',
          text: 'AI workflow validated',
          placementHint: 'center title',
        },
        {
          type: 'add-subtitle',
          id: 'ai-subtitle',
          text: 'Generated through mocked browser AI',
          placementHint: 'center subtitle',
        },
      ],
    });
    const slideElements = [
      JSON.stringify({
        type: 'text',
        id: 'ai-title-element',
        text: 'AI workflow validated',
        x: 240,
        y: 320,
        width: 1440,
        height: 140,
        rotation: 0,
        opacity: 1,
        fontFamily: 'Orbitron',
        fontSize: 88,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      }),
      JSON.stringify({
        type: 'text',
        id: 'ai-subtitle-element',
        text: 'Generated through mocked browser AI',
        x: 360,
        y: 520,
        width: 1200,
        height: 100,
        rotation: 0,
        opacity: 1,
        fontFamily: 'Open Sans',
        fontSize: 42,
        fontWeight: 600,
        fill: '#FFFFFF',
        align: 'center',
      }),
    ];
    let promptResponseIndex = 0;
    let elementResponseIndex = 0;

    type MonitorOptions = { monitor?: ((target: EventTarget) => void) | undefined };

    Object.defineProperty(window, 'LanguageModel', {
      configurable: true,
      value: {
        availability: async () => {
          await Promise.resolve();
          return 'available';
        },
        create: async (options: MonitorOptions = {}) => {
          await Promise.resolve();
          const monitorTarget = new EventTarget();
          options.monitor?.(monitorTarget);
          monitorTarget.dispatchEvent(
            new CustomEvent('downloadprogress', { detail: { loaded: 1, total: 1 } }),
          );
          return {
            destroy: () => undefined,
            prompt: async () => {
              await Promise.resolve();
              if (promptResponseIndex === 0) {
                promptResponseIndex += 1;
                return slideTasks;
              }
              promptResponseIndex += 1;
              const response = slideElements[elementResponseIndex] ?? slideElements.at(-1)!;
              elementResponseIndex += 1;
              return response;
            },
          };
        },
      },
    });

    Object.defineProperty(window, 'LanguageDetector', {
      configurable: true,
      value: {
        create: async () => {
          await Promise.resolve();
          return {
            detect: async () => {
              await Promise.resolve();
              return [{ detectedLanguage: 'en' }];
            },
          };
        },
      },
    });

    Object.defineProperty(window, 'Translator', {
      configurable: true,
      value: {
        availability: async () => {
          await Promise.resolve();
          return 'available';
        },
        create: async (options: MonitorOptions & { targetLanguage?: string } = {}) => {
          await Promise.resolve();
          const monitorTarget = new EventTarget();
          options.monitor?.(monitorTarget);
          monitorTarget.dispatchEvent(new ProgressEvent('downloadprogress', { loaded: 1 }));
          return {
            ready: Promise.resolve(),
            translate: async (text: string) => {
              await Promise.resolve();
              return `[${options.targetLanguage}] ${text}`;
            },
          };
        },
      },
    });

    const originalWorker = window.Worker;
    class MockLocalStudioWorker {
      onerror: ((event: ErrorEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      readonly url: string;

      constructor(url: string | URL) {
        this.url = String(url);
        if (
          !this.url.includes('bonsaiImageRuntime.worker') &&
          !this.url.includes('transformersRuntime.worker')
        ) {
          return new originalWorker(url) as unknown as MockLocalStudioWorker;
        }
      }

      postMessage(message: { id?: string; modelId?: string; options?: { steps?: number }; type?: string }) {
        const requestId = message.id ?? 'bonsai-e2e';
        if (this.url.includes('transformersRuntime.worker')) {
          queueMicrotask(() => {
            this.onmessage?.(
              new MessageEvent('message', {
                data: {
                  details: { file: message.modelId ?? message.type ?? 'local-model', loaded: 1, total: 1 },
                  id: requestId,
                  progress: 100,
                  type: 'progress',
                },
              }),
            );
            if (
              message.type === 'preload-image-editing' ||
              message.type === 'prepare-background-removal' ||
              message.type === 'remove-image-editing'
            ) {
              this.onmessage?.(
                new MessageEvent('message', {
                  data: { id: requestId, result: undefined, type: 'result' },
                }),
              );
              return;
            }
            if (message.type === 'segment-background-removal') {
              this.onmessage?.(
                new MessageEvent('message', {
                  data: {
                    id: requestId,
                    result: {
                      imageInput: {
                        channels: 4,
                        data: [55, 253, 118, 255, 5, 13, 16, 255, 255, 255, 255, 255, 0, 119, 154, 255],
                        height: 2,
                        width: 2,
                      },
                      subjectMask: {
                        data: [1, 0, 0, 1],
                        height: 2,
                        score: 0.92,
                        width: 2,
                      },
                    },
                    type: 'result',
                  },
                }),
              );
            }
          });
          return;
        }
        if (!this.url.includes('bonsaiImageRuntime.worker')) return;
        queueMicrotask(() => {
          this.onmessage?.(
            new MessageEvent('message', {
              data: { id: requestId, progress: 100, type: 'progress' },
            }),
          );
          const steps = Math.max(1, message.options?.steps ?? 1);
          this.onmessage?.(
            new MessageEvent('message', {
              data: { id: requestId, step: steps, totalSteps: steps, type: 'step' },
            }),
          );
          this.onmessage?.(
            new MessageEvent('message', {
              data: {
                blob: new Blob([new Uint8Array(pngBytes)], { type: 'image/png' }),
                id: requestId,
                type: 'result',
              },
            }),
          );
        });
      }

      addEventListener() {
        return undefined;
      }

      removeEventListener() {
        return undefined;
      }

      terminate() {
        return undefined;
      }
    }
    Object.defineProperty(window, 'Worker', { configurable: true, value: MockLocalStudioWorker });
  }, Array.from(generatedImagePng));
}
