import { describe, expect, it } from 'vitest';
import { createTransformersProgressCallback } from '../../../src/services/progress';

describe('createTransformersProgressCallback', () => {
  it('prefers Transformers.js aggregate progress over raw per-file progress', () => {
    const progress: number[] = [];
    const onProgress = createTransformersProgressCallback((value) => progress.push(value));

    onProgress({
      file: 'model_q4.onnx',
      loaded: 18,
      name: 'onnx-community/gemma',
      progress: 18,
      status: 'progress_total',
      total: 100,
    });
    onProgress({
      file: 'tokenizer.json',
      loaded: 100,
      name: 'onnx-community/gemma',
      progress: 100,
      status: 'progress',
      total: 100,
    });

    expect(progress).toEqual([18]);
  });

  it('aggregates per-file progress when aggregate progress is unavailable', () => {
    const progress: number[] = [];
    const onProgress = createTransformersProgressCallback((value) => progress.push(value));

    onProgress({
      file: 'a.onnx',
      loaded: 50,
      name: 'model',
      status: 'progress',
      total: 100,
    });
    onProgress({
      file: 'b.onnx',
      loaded: 25,
      name: 'model',
      status: 'progress',
      total: 100,
    });

    expect(progress).toEqual([50, 50]);
  });
});
