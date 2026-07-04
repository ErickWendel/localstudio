import type { MediaImportProgressState } from '../state/useEditorViewModel';

interface MediaImportProgressOverlayProps {
  onDismiss?: () => void;
  progress: MediaImportProgressState;
}

export function MediaImportProgressOverlay({
  onDismiss,
  progress,
}: MediaImportProgressOverlayProps) {
  const progressValue = progress.tone === 'loading' ? 62 : 100;

  return (
    <div className="presentation-import-backdrop" role="status" aria-live="polite">
      <div className="presentation-import-panel">
        <div className="presentation-import-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="presentation-import-copy">
          <span className="presentation-import-stage">
            {progress.tone === 'loading' ? 'Importing media' : 'Import blocked'}
          </span>
          <h2>{progress.title}</h2>
          <p>{progress.detail}</p>
        </div>
        {progress.tone === 'loading' ? (
          <>
            <div
              className="presentation-import-progress"
              role="progressbar"
              aria-label="Media import progress"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progressValue}
            >
              <span style={{ width: `${progressValue}%` }} />
            </div>
            <div className="presentation-import-progress-meta">
              <span>Loading</span>
              <span>Keeping large video files off the main memory path</span>
            </div>
          </>
        ) : (
          <button className="presentation-import-dismiss" type="button" onClick={onDismiss}>
            OK
          </button>
        )}
      </div>
    </div>
  );
}
