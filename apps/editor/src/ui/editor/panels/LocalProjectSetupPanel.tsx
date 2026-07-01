import { useEffect, useRef, useState } from 'react';

interface LocalProjectSetupPanelProps {
  initialName: string;
  onCancel: () => void;
  onConfirm: (projectName: string) => void;
}

export function LocalProjectSetupPanel({
  initialName,
  onCancel,
  onConfirm,
}: LocalProjectSetupPanelProps) {
  const [draftName, setDraftName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const normalizedName = draftName.trim();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <aside
      className="local-project-setup-panel"
      data-anchor="persistence"
      role="dialog"
      aria-modal="false"
      aria-label="Save local project"
    >
      <div className="settings-panel-header">
        <div>
          <h2>Save local project</h2>
          <p>Name the project folder before choosing where to create it.</p>
        </div>
        <button
          className="stitch-icon-button"
          type="button"
          aria-label="Cancel local save"
          onClick={onCancel}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>

      <label className="local-project-setup-field">
        <span>Project folder name</span>
        <input
          ref={inputRef}
          aria-label="Project folder name"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && normalizedName) {
              event.preventDefault();
              onConfirm(normalizedName);
            }
            if (event.key === 'Escape') {
              onCancel();
            }
          }}
        />
      </label>

      <div className="mirror-settings-actions">
        <button className="footer-toggle" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="export-button font-orbitron"
          type="button"
          disabled={!normalizedName}
          onClick={() => onConfirm(normalizedName)}
        >
          Choose folder
        </button>
      </div>
    </aside>
  );
}
