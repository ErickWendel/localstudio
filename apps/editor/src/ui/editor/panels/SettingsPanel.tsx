interface SettingsPanelProps {
  onClose: () => void;
  onOpenMediaSettings: () => void;
  onOpenMirrorSettings: () => void;
}

export function SettingsPanel({ onClose, onOpenMediaSettings, onOpenMirrorSettings }: SettingsPanelProps) {
  return (
    <aside className="settings-panel" role="dialog" aria-modal="false" aria-label="Settings">
      <div className="settings-panel-header ew-split-row-start">
        <h2>Settings</h2>
        <button className="stitch-icon-button" type="button" aria-label="Close settings" onClick={onClose}>
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>
      <button className="settings-panel-row" type="button" onClick={onOpenMirrorSettings}>
        <span className="material-symbols-outlined" aria-hidden="true">
          cloud_sync
        </span>
        <span>Mirror settings</span>
      </button>
      <button className="settings-panel-row" type="button" onClick={onOpenMediaSettings}>
        <span className="material-symbols-outlined" aria-hidden="true">
          image_search
        </span>
        <span>Media integrations</span>
      </button>
    </aside>
  );
}
