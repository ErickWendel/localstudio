import type { MirrorSyncProgress } from '../../../services/contracts/interfaces';

interface ToolbarMirrorProgressProps {
  progress: MirrorSyncProgress;
}

function getProgressPercent(progress: MirrorSyncProgress) {
  if (progress.total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((progress.current / progress.total) * 100)));
}

export function ToolbarMirrorProgress({ progress }: ToolbarMirrorProgressProps) {
  const progressPercent = getProgressPercent(progress);

  return (
    <div
      className="toolbar-sync-progress"
      role="status"
      aria-label={`Mirror syncing ${progressPercent}%`}
      aria-live="polite"
    >
      <span
        className="operation-notice-progress toolbar-sync-progress-bar"
        role="progressbar"
        aria-label="Mirror sync progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPercent}
      >
        <span
          className="operation-notice-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </span>
      <span className="toolbar-sync-progress-percent">{progressPercent}%</span>
    </div>
  );
}
