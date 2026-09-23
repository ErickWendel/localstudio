import { useEffect, useRef, useState } from 'react';

interface LocalProjectSetupPanelProps {
  description?: string;
  initialName: string;
  title?: string;
  onCancel: () => void;
  onConfirm: (projectName: string) => void;
}

export function LocalProjectSetupPanel({
  description = 'Name the project folder before choosing where to create it.',
  initialName,
  title = 'Save local project',
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
      aria-label={title}
    >
      <div className="settings-panel-header ew-split-row-start">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
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

      <label className="local-project-setup-field ew-field-scope">
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
