import { bonsaiImageRuntime } from './bonsaiImageRuntime';
import type { BonsaiImageWorkerRequest, BonsaiImageWorkerResponse } from './bonsaiImageRuntime';

const runtime = new bonsaiImageRuntime.BrowserBonsaiImageRuntime();

function postResponse(response: BonsaiImageWorkerResponse) {
  self.postMessage(response);
}

type BonsaiProgressDetails = Extract<BonsaiImageWorkerResponse, { type: 'progress' }>['details'];

function postProgress(id: string, progress: number, details: BonsaiProgressDetails | undefined) {
  postResponse({
    ...(details ? { details } : {}),
    id,
    progress,
    type: 'progress',
  });
}

self.onmessage = (event: MessageEvent<BonsaiImageWorkerRequest>) => {
  const request = event.data;
  void handleRequest(request);
};

async function handleRequest(request: BonsaiImageWorkerRequest) {
  try {
    if (request.type === 'preload') {
      await runtime.preload(request.modelId, {
        onProgress: (progress, details) => {
          postProgress(request.id, progress, details);
        },
      });
      postResponse({ id: request.id, type: 'result' });
      return;
    }

    const blob = await runtime.generate({
      ...request.options,
      onLoadProgress: (progress, details) => {
        postProgress(request.id, progress, details);
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
