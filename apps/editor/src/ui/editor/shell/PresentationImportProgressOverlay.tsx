import type { PresentationImportProgressState } from '../state/useEditorViewModel';

interface PresentationImportProgressOverlayProps {
  progress: PresentationImportProgressState;
}

const stageLabels: Record<PresentationImportProgressState['stage'], string> = {
  reading: 'Reading package',
  inspecting: 'Inspecting PPTX structure',
  'extracting-objects': 'Extracting text and images',
  'downloading-fonts': 'Downloading fonts',
  'extracting-media': 'Extracting videos',
  'mapping-animations': 'Mapping animations',
  opening: 'Opening editor',
};

export function PresentationImportProgressOverlay({
  progress,
}: PresentationImportProgressOverlayProps) {
  return (
    <div className="presentation-import-backdrop" role="status" aria-live="polite">
      <div className="presentation-import-panel">
        <div className="presentation-import-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="presentation-import-copy">
          <span className="presentation-import-stage">{stageLabels[progress.stage]}</span>
          <h2>{progress.title}</h2>
          <p>{progress.detail}</p>
        </div>
        <div
          className="presentation-import-progress"
          role="progressbar"
          aria-label="PowerPoint import progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(progress.progress)}
        >
          <span style={{ width: `${progress.progress}%` }} />
        </div>
        <div className="presentation-import-progress-meta">
          <span>{Math.round(progress.progress)}%</span>
          <span>Preserving editable objects and original media</span>
        </div>
      </div>
    </div>
  );
}
