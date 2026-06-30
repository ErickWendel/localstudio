import { useEffect, useRef } from 'react';
import type { MirrorProjectSummary } from '../../services/interfaces';

export type RemoteImportStatus = 'loading' | 'ready' | 'empty' | 'importing' | 'failed';

interface RemoteImportPanelProps {
  error?: string | undefined;
  projects: MirrorProjectSummary[];
  status: RemoteImportStatus;
  onClose: () => void;
  onImportProject: (projectId: string) => void;
}

function formatSyncedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last sync unknown';
  return `Synced ${date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`;
}

export function RemoteImportPanel({
  error,
  projects,
  status,
  onClose,
  onImportProject,
}: RemoteImportPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const busy = status === 'loading' || status === 'importing';

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  return (
    <aside
      ref={panelRef}
      className="remote-import-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Import remote project"
    >
      <div className="settings-panel-header">
        <div>
          <h2>Import remote</h2>
          <p>Choose a mirrored project from MinIO.</p>
        </div>
        <button
          className="stitch-icon-button"
          type="button"
          aria-label="Close remote import"
          onClick={onClose}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>

      {status === 'loading' ? <p className="remote-import-status">Loading mirrors...</p> : null}
      {status === 'empty' ? (
        <p className="remote-import-status">No mirrored projects were found in this bucket.</p>
      ) : null}
      {status === 'failed' ? (
        <p className="remote-import-status remote-import-status-error">
          {error ?? 'Could not import the remote mirror.'}
        </p>
      ) : null}

      {projects.length > 0 ? (
        <div className="remote-import-list">
          {projects.map((project) => (
            <button
              className="remote-import-row"
              disabled={busy}
              key={project.id}
              type="button"
              aria-label={`Import ${project.name}`}
              onClick={() => onImportProject(project.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                cloud_download
              </span>
              <span>
                <strong>{project.name}</strong>
                <small>{formatSyncedAt(project.syncedAt)}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
