import type { ModelDownloadProgressDetails } from '../contracts/interfaces';

function clampProgress(progress: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(progress)));
}

function mapProgressToRange(progress: number, min: number, max: number) {
  return min + (clampProgress(progress) / 100) * (max - min);
}

function createMonotonicProgressReporter(
  onProgress: ((progress: number, details?: ModelDownloadProgressDetails) => void) | undefined,
  options: { initial?: number; min?: number; max?: number } = {},
) {
  let latest = options.initial ?? options.min ?? 0;
  const min = options.min ?? 0;
  const max = options.max ?? 100;

  return (progress: number, details?: ModelDownloadProgressDetails) => {
    const next = Math.max(latest, clampProgress(progress, min, max));
    latest = next;
    onProgress?.(next, details);
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
  onProgress: ((progress: number, details?: ModelDownloadProgressDetails) => void) | undefined,
  options: { initial?: number; min?: number; max?: number } = {},
) {
  const reportProgress = createMonotonicProgressReporter(onProgress, options);
  const fileProgress = new Map<string, { loaded: number; total: number }>();
  let receivedAggregateProgress = false;

  return (event: unknown) => {
    if (!isTransformersProgressEvent(event)) return;

    if (event.status === 'progress_total' && typeof event.progress === 'number') {
      receivedAggregateProgress = true;
      reportProgress(event.progress, getByteProgressDetails(event));
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
      if (total > 0)
        reportProgress((loaded / total) * 100, { loadedBytes: loaded, totalBytes: total });
      return;
    }

    if (event.status === 'progress' && typeof event.progress === 'number') {
      reportProgress(event.progress);
    }
  };
}

function getByteProgressDetails(
  event: TransformersProgressEvent,
): ModelDownloadProgressDetails | undefined {
  if (typeof event.loaded !== 'number' || typeof event.total !== 'number' || event.total <= 0) {
    return undefined;
  }

  return {
    loadedBytes: Math.max(0, event.loaded),
    totalBytes: Math.max(1, event.total),
  };
}

function estimateRemainingMs({
  elapsedMs,
  loadedBytes,
  totalBytes,
}: {
  elapsedMs: number;
  loadedBytes?: number | undefined;
  totalBytes?: number | undefined;
}) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return undefined;
  if (!Number.isFinite(loadedBytes) || !Number.isFinite(totalBytes)) return undefined;
  if (!loadedBytes || !totalBytes || loadedBytes <= 0 || totalBytes <= loadedBytes)
    return undefined;

  const remainingMs = elapsedMs * ((totalBytes - loadedBytes) / loadedBytes);
  return Number.isFinite(remainingMs) ? Math.round(remainingMs) : undefined;
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
  estimateRemainingMs,
  createEstimatedProgressTicker,
};
