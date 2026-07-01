import { DirectTransformersOperations } from './transformersOperations';
import type { TransformersWorkerRequest, TransformersWorkerResponse } from './transformersRuntimeClient';

const operations = new DirectTransformersOperations();

function postResponse(response: TransformersWorkerResponse) {
  self.postMessage(response);
}

self.onmessage = (event: MessageEvent<TransformersWorkerRequest>) => {
  const request = event.data;
  void handleRequest(request);
};

async function handleRequest(request: TransformersWorkerRequest) {
  try {
    if (request.type === 'preload-text-generation') {
      await operations.preloadTextGeneration(request.modelId, {
        onProgress: (progress) => postResponse({ id: request.id, progress, type: 'progress' }),
      });
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    if (request.type === 'generate-text') {
      const result = await operations.generateText(request.modelId, request.prompt, request.options);
      postResponse({ id: request.id, result, type: 'result' });
      return;
    }

    if (request.type === 'release-text-generation') {
      await operations.releaseTextGeneration(request.modelId);
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    if (request.type === 'remove-text-generation') {
      await operations.removeTextGeneration(request.modelId);
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    if (request.type === 'preload-language-detection') {
      await operations.preloadLanguageDetection(request.modelId, {
        onProgress: (progress) => postResponse({ id: request.id, progress, type: 'progress' }),
      });
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    if (request.type === 'detect-language') {
      const result = await operations.detectLanguage(request.modelId, request.text);
      postResponse({ id: request.id, result, type: 'result' });
      return;
    }

    if (request.type === 'preload-image-editing') {
      await operations.preloadImageEditing({
        onProgress: (progress) => postResponse({ id: request.id, progress, type: 'progress' }),
      });
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    if (request.type === 'prepare-background-removal') {
      await operations.prepareBackgroundRemoval(request.objectUrl, {
        onProgress: (progress) => postResponse({ id: request.id, progress, type: 'progress' }),
      });
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    if (request.type === 'segment-background-removal') {
      const result = await operations.segmentBackgroundRemoval(request.objectUrl, request.points);
      postResponse({ id: request.id, result, type: 'result' });
    }
  } catch (error) {
    postResponse({
      id: request.id,
      message: error instanceof Error ? error.message : 'Transformers worker failed.',
      type: 'error',
    });
  }
}
