export type ProgressContractResult = {
  progressValues: number[];
  remainingMs: number | null;
};

export async function evaluateProgressContract(): Promise<ProgressContractResult> {
  const { progress } = (await import(
    '/editor/src/services/model-setup/progress.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/progress');

  const progressEvents: Array<{ details?: unknown; progress: number }> = [];
  const monotonic = progress.createMonotonicProgressReporter((value, details) => {
    progressEvents.push({ details, progress: value });
  });
  monotonic(12.2);
  monotonic(8);

  const transformersProgress = progress.createTransformersProgressCallback((value, details) => {
    progressEvents.push({ details, progress: value });
  });
  transformersProgress({ file: 'a.bin', loaded: 25, name: 'model', status: 'progress', total: 100 });
  transformersProgress({ file: 'b.bin', loaded: 50, name: 'model', status: 'progress', total: 100 });
  transformersProgress({ loaded: 90, progress: 90, status: 'progress_total', total: 100 });
  transformersProgress({ progress: 10, status: 'progress' });
  monotonic(100);

  return {
    progressValues: progressEvents.map((event) => event.progress),
    remainingMs: progress.estimateRemainingMs({
      elapsedMs: 1000,
      loadedBytes: 25,
      totalBytes: 100,
    }),
  };
}
