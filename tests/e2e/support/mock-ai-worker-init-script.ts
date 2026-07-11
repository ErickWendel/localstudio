import { mockAiWorkerBonsaiRuntime } from './mock-ai-worker-bonsai-runtime';
import { mockAiWorkerImageEditingRuntime } from './mock-ai-worker-image-editing-runtime';
import { mockAiWorkerTransformersControlRuntime } from './mock-ai-worker-transformers-control-runtime';
import { mockAiWorkerTransformersLanguageRuntime } from './mock-ai-worker-transformers-language-runtime';
import { mockAiWorkerTransformersRuntime } from './mock-ai-worker-transformers-runtime';
import { mockAiWorkerTransformersTextRuntime } from './mock-ai-worker-transformers-text-runtime';
import type { MockAiWorkerPayload } from './mock-ai-worker-types';

export const mockAiWorkerInitScript = {
  build(payload: MockAiWorkerPayload) {
    return `
      (() => {
        const payload = ${JSON.stringify(payload)};
        const originalWorker = window.Worker;
        const controlRuntime = (${mockAiWorkerTransformersControlRuntime.source()})();
        const textRuntime = (${mockAiWorkerTransformersTextRuntime.source()})(payload);
        const languageRuntime = (${mockAiWorkerTransformersLanguageRuntime.source()})();
        const imageEditingRuntime = (${mockAiWorkerImageEditingRuntime.source()})();
        const transformersRuntime = (${mockAiWorkerTransformersRuntime.source()})(
          payload,
          controlRuntime,
          textRuntime,
          languageRuntime,
          imageEditingRuntime
        );
        const bonsaiRuntime = (${mockAiWorkerBonsaiRuntime.source()})(payload);

        class MockLocalStudioWorker {
          onerror = null;
          onmessage = null;

          constructor(url) {
            this.url = String(url);
            if (
              !this.url.includes('bonsaiImageRuntime.worker') &&
              !this.url.includes('transformersRuntime.worker')
            ) {
              return new originalWorker(url);
            }
          }

          postMessage(message) {
            const requestId = message.id ?? 'bonsai-e2e';
            if (this.url.includes('transformersRuntime.worker')) {
              transformersRuntime.handle(this, requestId, message);
              return;
            }
            if (this.url.includes('bonsaiImageRuntime.worker')) {
              bonsaiRuntime.handle(this, requestId, message);
            }
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

        Object.defineProperty(window, 'Worker', {
          configurable: true,
          value: MockLocalStudioWorker,
        });
      })();
    `;
  },
};
