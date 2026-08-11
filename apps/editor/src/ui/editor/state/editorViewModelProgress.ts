import type {
  MirrorSyncProgress,
  ModelDownloadProgressDetails,
} from '../../../services/contracts/interfaces';

const IMAGE_GENERATION_DIMENSION_MULTIPLE = 16;

function getDownloadProgressPatch(
  progress: number,
  details: ModelDownloadProgressDetails | undefined,
): ModelDownloadProgressDetails & { progress: number } {
  return {
    estimatedRemainingMs: details?.estimatedRemainingMs,
    loadedBytes: details?.loadedBytes,
    progress,
    totalBytes: details?.totalBytes,
  };
}

function normalizeImageGenerationDimension(value: number) {
  return Math.max(
    IMAGE_GENERATION_DIMENSION_MULTIPLE,
    Math.round(value / IMAGE_GENERATION_DIMENSION_MULTIPLE) * IMAGE_GENERATION_DIMENSION_MULTIPLE,
  );
}

function getMirrorProgressFraction(progress: MirrorSyncProgress): number {
  if (progress.total <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, progress.current / progress.total));
}

function selectMonotonicMirrorProgress(
  current: MirrorSyncProgress | undefined,
  next: MirrorSyncProgress,
): MirrorSyncProgress {
  return !current || getMirrorProgressFraction(next) >= getMirrorProgressFraction(current)
    ? next
    : current;
}

export const editorViewModelProgress = {
  getDownloadProgressPatch,
  normalizeImageGenerationDimension,
  selectMonotonicMirrorProgress,
};
