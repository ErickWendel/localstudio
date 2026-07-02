import { useEffect, useRef, useState } from 'react';
import type { MirrorProjectSummary } from '../../../services/contracts/interfaces';
import { IconButton } from '../../components/IconButton';

export type RemoteImportStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'importing'
  | 'deleting'
  | 'failed';

interface RemoteImportPanelProps {
  error?: string | undefined;
  projects: MirrorProjectSummary[];
  status: RemoteImportStatus;
  onClose: () => void;
  onDeleteProject?: (projectId: string) => void;
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
  onDeleteProject,
  onImportProject,
}: RemoteImportPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | undefined>();
  const busy = status === 'loading' || status === 'importing' || status === 'deleting';
  const deleteProject = projects.find((project) => project.id === deleteProjectId);

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
        <div className="remote-import-list" role="list" aria-label="Remote mirrored projects">
          {projects.map((project) => (
            <div className="remote-import-list-item" role="listitem" key={project.id}>
              {deleteProject?.id === project.id ? (
                <div
                  className="remote-import-confirm"
                  role="alertdialog"
                  aria-label="Delete remote project"
                >
                  <p>
                    Remove <strong>{deleteProject.name}</strong> from the remote mirror?
                  </p>
                  <div className="remote-import-confirm-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => setDeleteProjectId(undefined)}
                    >
                      Cancel
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        onDeleteProject?.(deleteProject.id);
                        setDeleteProjectId(undefined);
                      }}
                    >
                      Delete remote project
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="remote-import-row-shell">
                <button
                  className="remote-import-row"
                  disabled={busy}
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
                {onDeleteProject ? (
                  <IconButton
                    label={`Delete ${project.name} from remote`}
                    disabled={busy}
                    tone="danger"
                    onClick={() => setDeleteProjectId(project.id)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      close
                    </span>
                  </IconButton>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
