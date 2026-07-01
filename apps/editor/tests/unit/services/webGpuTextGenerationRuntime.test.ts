import { describe, expect, it, vi } from 'vitest';
import { extractGeneratedText } from '../../../src/services/webGpuTextGenerationRuntime';
import {
  TransformersRuntimeClient,
  type TransformersWorkerRequest,
  type TransformersWorkerResponse,
} from '../../../src/services/transformersRuntimeClient';

describe('extractGeneratedText', () => {
  it('extracts plain generated text responses', () => {
    expect(extractGeneratedText([{ generated_text: 'hello' }])).toBe('hello');
  });

  it('extracts the last assistant content from chat-style generated text responses', () => {
    expect(
      extractGeneratedText([
        {
          generated_text: [
            { role: 'user', content: { text: 'hello' } },
            { role: 'assistant', content: 'olá' },
          ],
        },
      ]),
    ).toBe('olá');
  });
});

describe('TransformersRuntimeClient', () => {
  class FakeWorker {
    onmessage: ((event: MessageEvent<TransformersWorkerResponse>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    messages: TransformersWorkerRequest[] = [];
    postMessage = vi.fn((message: TransformersWorkerRequest) => {
      this.messages.push(message);
    });

    emit(response: TransformersWorkerResponse) {
      this.onmessage?.({ data: response } as MessageEvent<TransformersWorkerResponse>);
    }
  }

  function lastWorkerMessage(worker: FakeWorker) {
    const message = worker.messages.at(-1);
    if (!message) throw new Error('Expected the worker to receive a message.');
    return message;
  }

  it('preloads text generation through the worker and forwards progress', async () => {
    const worker = new FakeWorker();
    const client = new TransformersRuntimeClient({
      createWorker: () => worker as unknown as Worker,
    });
    const progress: number[] = [];

    const preloadPromise = client.preloadTextGeneration('model-id', {
      onProgress: (value) => progress.push(value),
    });
    const message = lastWorkerMessage(worker);
    expect(message).toEqual({
      id: message.id,
      modelId: 'model-id',
      type: 'preload-text-generation',
    });

    worker.emit({ id: message.id, progress: 48, type: 'progress' });
    worker.emit({ id: message.id, type: 'result' });

    await expect(preloadPromise).resolves.toBeUndefined();
    expect(progress).toEqual([48]);
  });

  it('returns generated text from the worker', async () => {
    const worker = new FakeWorker();
    const client = new TransformersRuntimeClient({
      createWorker: () => worker as unknown as Worker,
    });

    const generatePromise = client.generateText('model-id', 'hello', { max_new_tokens: 32 });
    const message = lastWorkerMessage(worker);
    expect(message).toEqual({
      id: message.id,
      modelId: 'model-id',
      options: { max_new_tokens: 32 },
      prompt: 'hello',
      type: 'generate-text',
    });

    worker.emit({ id: message.id, result: 'olá', type: 'result' });

    await expect(generatePromise).resolves.toBe('olá');
  });

  it('returns language detection results from the worker', async () => {
    const worker = new FakeWorker();
    const client = new TransformersRuntimeClient({
      createWorker: () => worker as unknown as Worker,
    });

    const detectionPromise = client.detectLanguage('detector-id', 'Bonjour');
    const message = lastWorkerMessage(worker);
    expect(message).toEqual({
      id: message.id,
      modelId: 'detector-id',
      text: 'Bonjour',
      type: 'detect-language',
    });

    worker.emit({ id: message.id, result: { language: 'fr', score: 0.99 }, type: 'result' });

    await expect(detectionPromise).resolves.toEqual({ language: 'fr', score: 0.99 });
  });

  it('returns background segmentation results from the worker', async () => {
    const worker = new FakeWorker();
    const client = new TransformersRuntimeClient({
      createWorker: () => worker as unknown as Worker,
    });
    const points = [{ x: 0.5, y: 0.5, positive: true }];
    const segmentation = {
      imageInput: { data: new Uint8Array([255, 0, 0, 255]), width: 1, height: 1, channels: 4 },
      subjectMask: { data: new Uint8Array([1]), width: 1, height: 1, score: 1 },
    };

    const segmentationPromise = client.segmentBackgroundRemoval('blob:source', points);
    const message = lastWorkerMessage(worker);
    expect(message).toEqual({
      id: message.id,
      objectUrl: 'blob:source',
      points,
      type: 'segment-background-removal',
    });

    worker.emit({ id: message.id, result: segmentation, type: 'result' });

    await expect(segmentationPromise).resolves.toEqual(segmentation);
  });
});
