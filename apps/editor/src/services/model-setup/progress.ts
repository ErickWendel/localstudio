function clampProgress(progress: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(progress)));
}

function mapProgressToRange(progress: number, min: number, max: number) {
  return min + (clampProgress(progress) / 100) * (max - min);
}

function createMonotonicProgressReporter(
  onProgress: ((progress: number) => void) | undefined,
  options: { initial?: number; min?: number; max?: number } = {},
) {
  let latest = options.initial ?? options.min ?? 0;
  const min = options.min ?? 0;
  const max = options.max ?? 100;

  return (progress: number) => {
    const next = Math.max(latest, clampProgress(progress, min, max));
    latest = next;
    onProgress?.(next);
    return next;
  };
}

interface TransformersProgressEvent {
  file?: string;
  loaded?: number;
  name?: string;
  progress?: number;
  status?: string;
  total?: number;
}

function isTransformersProgressEvent(event: unknown): event is TransformersProgressEvent {
  return Boolean(event && typeof event === 'object');
}

function createTransformersProgressCallback(
  onProgress: ((progress: number) => void) | undefined,
  options: { initial?: number; min?: number; max?: number } = {},
) {
  const reportProgress = createMonotonicProgressReporter(onProgress, options);
  const fileProgress = new Map<string, { loaded: number; total: number }>();
  let receivedAggregateProgress = false;

  return (event: unknown) => {
    if (!isTransformersProgressEvent(event)) return;

    if (event.status === 'progress_total' && typeof event.progress === 'number') {
      receivedAggregateProgress = true;
      reportProgress(event.progress);
      return;
    }

    if (receivedAggregateProgress) return;

    if (
      event.status === 'progress' &&
      event.file &&
      typeof event.loaded === 'number' &&
      typeof event.total === 'number' &&
      event.total > 0
    ) {
      fileProgress.set(`${event.name ?? 'model'}:${event.file}`, {
        loaded: Math.max(0, event.loaded),
        total: Math.max(1, event.total),
      });
      const totals = Array.from(fileProgress.values());
      const loaded = totals.reduce((sum, file) => sum + Math.min(file.loaded, file.total), 0);
      const total = totals.reduce((sum, file) => sum + file.total, 0);
      if (total > 0) reportProgress((loaded / total) * 100);
      return;
    }

    if (event.status === 'progress' && typeof event.progress === 'number') {
      reportProgress(event.progress);
    }
  };
}
function createEstimatedProgressTicker(
  onProgress: (progress: number) => void,
  options: { intervalMs?: number; max: number; start: number; step?: number },
) {
  let latest = options.start;
  const intervalMs = options.intervalMs ?? 1_500;
  const step = options.step ?? 1;
  const timer = setInterval(() => {
    if (latest >= options.max) return;
    latest = Math.min(options.max, latest + step);
    onProgress(latest);
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
}

export const progress = {
  clampProgress,
  mapProgressToRange,
  createMonotonicProgressReporter,
  createTransformersProgressCallback,
  createEstimatedProgressTicker,
};
