import type { ModelDownloadProgressDetails } from '../../../services/contracts/interfaces';

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

export const editorViewModelProgress = {
  getDownloadProgressPatch,
  normalizeImageGenerationDimension,
};
