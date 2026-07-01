import {
  BrowserBonsaiImageRuntime,
  type BonsaiImageWorkerRequest,
  type BonsaiImageWorkerResponse,
} from './bonsaiImageRuntime';

const runtime = new BrowserBonsaiImageRuntime();

function postResponse(response: BonsaiImageWorkerResponse) {
  self.postMessage(response);
}

self.onmessage = (event: MessageEvent<BonsaiImageWorkerRequest>) => {
  const request = event.data;
  void handleRequest(request);
};

async function handleRequest(request: BonsaiImageWorkerRequest) {
  try {
    if (request.type === 'preload') {
      await runtime.preload(request.modelId, {
        onProgress: (progress) => {
          postResponse({ id: request.id, progress, type: 'progress' });
        },
      });
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    const blob = await runtime.generate({
      ...request.options,
      onLoadProgress: (progress) => {
        postResponse({ id: request.id, progress, type: 'progress' });
      },
      onStep: (step, totalSteps) => {
        postResponse({ id: request.id, step, totalSteps, type: 'step' });
      },
    });
    postResponse({ blob, id: request.id, type: 'result' });
  } catch (error) {
    postResponse({
      id: request.id,
      message: error instanceof Error ? error.message : 'Bonsai image worker failed.',
      type: 'error',
    });
  }
}
