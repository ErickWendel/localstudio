interface BackgroundSelectionMessageOptions {
  backgroundPreparation:
    | { elementId: string; progress: number; status: 'preparing' | 'ready' | 'failed' }
    | undefined;
  backgroundPreview:
    | { elementId: string; maskUrl?: string; pending: boolean; score?: number }
    | undefined;
  backgroundSelectionNotice: string | undefined;
  backgroundSelectionTargetId: string | undefined;
  processingSelectedImageId: string | undefined;
}

function getMessage({
  backgroundPreparation,
  backgroundPreview,
  backgroundSelectionNotice,
  backgroundSelectionTargetId,
  processingSelectedImageId,
}: BackgroundSelectionMessageOptions) {
  if (processingSelectedImageId) return 'Removing background...';
  if (backgroundSelectionNotice) return backgroundSelectionNotice;
  if (backgroundPreparation?.status === 'failed')
    return 'Image extraction failed. Try background removal again.';
  if (backgroundPreparation?.status === 'preparing') return 'Extracting image embedding...';
  const previewScore =
    backgroundPreview && backgroundPreview.elementId === backgroundSelectionTargetId
      ? backgroundPreview.score
      : undefined;
  if (previewScore !== undefined) {
    return `Segment score: ${previewScore.toFixed(2)}`;
  }
  return 'Right click adds areas to keep. Left click applies the background removal.';
}

export const backgroundSelectionMessage = {
  getMessage,
};
