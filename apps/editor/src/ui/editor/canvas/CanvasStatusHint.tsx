import { backgroundSelectionMessage } from './background-selection-message';

interface CanvasStatusHintProps {
  backgroundPreparation:
    | { elementId: string; progress: number; status: 'preparing' | 'ready' | 'failed' }
    | undefined;
  backgroundPreview:
    | { elementId: string; maskUrl?: string; pending: boolean; score?: number }
    | undefined;
  backgroundSelectionNotice: string | undefined;
  backgroundSelectionTargetId: string | undefined;
  isTranslating: boolean;
  processingSelectedImageId: string | undefined;
  translationNotice: string | undefined;
  onCancelBackgroundSelection: (() => void) | undefined;
}

export function CanvasStatusHint({
  backgroundPreparation,
  backgroundPreview,
  backgroundSelectionNotice,
  backgroundSelectionTargetId,
  isTranslating,
  processingSelectedImageId,
  translationNotice,
  onCancelBackgroundSelection,
}: CanvasStatusHintProps) {
  const translationActive = isTranslating || Boolean(translationNotice);
  const icon = translationActive
    ? 'translate'
    : processingSelectedImageId
      ? 'auto_fix_high'
      : backgroundSelectionNotice
        ? 'download'
        : 'ads_click';
  const message = isTranslating
    ? 'Translating text...'
    : (translationNotice ??
      backgroundSelectionMessage.getMessage({
        backgroundPreparation,
        backgroundPreview,
        backgroundSelectionTargetId,
        backgroundSelectionNotice,
        processingSelectedImageId,
      }));

  return (
    <div
      className={`background-selection-hint ${
        translationActive ? 'background-selection-hint-translation' : ''
      }`}
      role="status"
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {icon}
      </span>
      <span>{message}</span>
      {backgroundPreparation?.status === 'preparing' && !isTranslating ? (
        <span
          aria-label="Image extraction progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={backgroundPreparation.progress}
          className="background-selection-progress"
          role="progressbar"
        >
          <span style={{ width: `${backgroundPreparation.progress}%` }} />
        </span>
      ) : null}
      {processingSelectedImageId || isTranslating ? null : (
        <button type="button" onClick={onCancelBackgroundSelection}>
          Esc
        </button>
      )}
    </div>
  );
}
