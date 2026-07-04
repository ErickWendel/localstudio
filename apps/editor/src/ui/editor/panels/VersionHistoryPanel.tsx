import type { VersionHistoryEntry } from '../../../services/contracts/interfaces';

interface VersionHistoryPanelProps {
  entries: VersionHistoryEntry[];
  highlightChanges: boolean;
  selectedVersionId?: string | undefined;
  onClose: () => void;
  onHighlightChangesChange: (enabled: boolean) => void;
  onRestoreVersion: (versionId: string) => void;
  onSelectVersion: (versionId: string) => void;
}

function formatVersionDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function VersionHistoryPanel({
  entries,
  highlightChanges,
  selectedVersionId,
  onClose,
  onHighlightChangesChange,
  onRestoreVersion,
  onSelectVersion,
}: VersionHistoryPanelProps) {
  const selectedEntry = entries.find((entry) => entry.id === selectedVersionId);

  return (
    <aside className="version-history-panel" aria-label="Version history">
      <div className="version-history-header">
        <h2>Version history</h2>
        <button className="stitch-icon-button" type="button" aria-label="Close version history" onClick={onClose}>
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>
      <select className="version-history-filter" aria-label="Version filter" value="all" onChange={() => undefined}>
        <option value="all">All versions</option>
      </select>
      {selectedEntry ? (
        <button
          className="compact-action compact-action-full version-history-restore ew-surface ew-surface-hover ew-compact-row"
          type="button"
          onClick={() => onRestoreVersion(selectedEntry.id)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            restore
          </span>
          Restore this version
        </button>
      ) : null}
      <div className="version-history-list">
        {entries.length === 0 ? <p className="panel-muted">No saved versions yet.</p> : null}
        {entries.map((entry, index) => (
          <button
            className={entry.id === selectedVersionId ? 'version-history-entry version-history-entry-active' : 'version-history-entry'}
            key={entry.id}
            type="button"
            onClick={() => onSelectVersion(entry.id)}
          >
            <strong>{formatVersionDate(entry.createdAt)}</strong>
            {index === 0 ? <span className="version-history-current">Current version</span> : null}
            <span>{entry.summary}</span>
            <span className="version-history-author">
              <span aria-hidden="true" />
              {entry.authorName}
            </span>
          </button>
        ))}
      </div>
      <label className="version-history-highlight">
        <input
          type="checkbox"
          checked={highlightChanges}
          onChange={(event) => onHighlightChangesChange(event.target.checked)}
        />
        Highlight changes
      </label>
    </aside>
  );
}
