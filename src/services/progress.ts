export function clampProgress(progress: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(progress)));
}

export function mapProgressToRange(progress: number, min: number, max: number) {
  return min + (clampProgress(progress) / 100) * (max - min);
}

export function createMonotonicProgressReporter(
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
