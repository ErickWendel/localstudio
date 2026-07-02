import { describe, expect, it } from 'vitest';
import type { ModelDownloadProgressDetails } from '../../../src/services/contracts/interfaces';
import { progress } from '../../../src/services/model-setup/progress';

describe('progress.createTransformersProgressCallback', () => {
  it('prefers Transformers.js aggregate progress over raw per-file progress', () => {
    const reportedProgress: number[] = [];
    const onProgress = progress.createTransformersProgressCallback((value) =>
      reportedProgress.push(value),
    );

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

    expect(reportedProgress).toEqual([18]);
  });

  it('reports aggregate byte progress details when Transformers.js provides them', () => {
    const reportedProgress: Array<[number, ModelDownloadProgressDetails | undefined]> = [];
    const onProgress = progress.createTransformersProgressCallback((value, details) =>
      reportedProgress.push([value, details]),
    );

    onProgress({
      file: 'model_q4.onnx',
      loaded: 1_200_000_000,
      name: 'onnx-community/gemma',
      progress: 64,
      status: 'progress_total',
      total: 3_800_000_000,
    });

    expect(reportedProgress).toEqual([
      [64, { loadedBytes: 1_200_000_000, totalBytes: 3_800_000_000 }],
    ]);
  });

  it('aggregates per-file progress when aggregate progress is unavailable', () => {
    const reportedProgress: Array<[number, ModelDownloadProgressDetails | undefined]> = [];
    const onProgress = progress.createTransformersProgressCallback((value, details) =>
      reportedProgress.push([value, details]),
    );

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

    expect(reportedProgress).toEqual([
      [50, { loadedBytes: 50, totalBytes: 100 }],
      [50, { loadedBytes: 75, totalBytes: 200 }],
    ]);
  });
});

describe('progress.estimateRemainingMs', () => {
  it('calculates remaining time from elapsed time and downloaded bytes', () => {
    expect(
      progress.estimateRemainingMs({
        elapsedMs: 60_000,
        loadedBytes: 1_200_000_000,
        totalBytes: 3_800_000_000,
      }),
    ).toBe(130_000);
  });

  it('omits remaining time when byte totals are not usable', () => {
    expect(
      progress.estimateRemainingMs({
        elapsedMs: 60_000,
        loadedBytes: 0,
        totalBytes: 3_800_000_000,
      }),
    ).toBeUndefined();
    expect(
      progress.estimateRemainingMs({
        elapsedMs: 60_000,
        loadedBytes: 3_800_000_000,
        totalBytes: 3_800_000_000,
      }),
    ).toBeUndefined();
  });
});
