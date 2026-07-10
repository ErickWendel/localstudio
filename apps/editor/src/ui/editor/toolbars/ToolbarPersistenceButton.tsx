import type { PersistenceStorageMode } from '../../../services/contracts/interfaces';

interface ToolbarPersistenceButtonProps {
  persistenceAttention: boolean;
  persistenceAvailable: boolean;
  persistenceEnabled: boolean;
  persistenceMode: PersistenceStorageMode;
  onPersistenceToggle: ((enabled: boolean) => void) | undefined;
}

export function ToolbarPersistenceButton({
  persistenceAttention,
  persistenceAvailable,
  persistenceEnabled,
  persistenceMode,
  onPersistenceToggle,
}: ToolbarPersistenceButtonProps) {
  const persistenceLabel = !persistenceAvailable
    ? 'Persistence unavailable'
    : persistenceMode === 'opfs'
      ? persistenceEnabled
        ? 'Browser storage enabled'
        : 'Browser storage disabled'
      : persistenceEnabled
        ? 'Persistence enabled'
        : 'Persistence disabled';
  const persistenceTitle = !persistenceAvailable
    ? 'Local project persistence is not available in this browser.'
    : persistenceMode === 'opfs'
      ? persistenceEnabled
        ? 'Browser-private project storage is enabled. Files are stored by this browser profile and are not visible in Finder.'
        : 'Save this deck in browser-private storage. Files are scoped to this browser profile and are not visible in Finder.'
      : persistenceEnabled
        ? 'Local folder persistence is enabled'
        : 'Save this deck to a local folder';
  const className = !persistenceAvailable
    ? 'stitch-icon-button persistence-off persistence-unavailable'
    : persistenceEnabled
      ? 'stitch-icon-button persistence-on'
      : persistenceAttention
        ? 'stitch-icon-button persistence-off persistence-attention'
        : 'stitch-icon-button persistence-off';

  return (
    <button
      className={className}
      disabled={!persistenceAvailable}
      title={persistenceTitle}
      type="button"
      aria-label={persistenceLabel}
      data-tour-id="storage-toggle"
      onClick={() => {
        if (!persistenceAvailable) return;
        onPersistenceToggle?.(!persistenceEnabled);
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {persistenceEnabled ? 'cloud_done' : 'cloud_off'}
      </span>
      {!persistenceAvailable ? (
        <span className="persistence-unavailable-x" aria-hidden="true">
          ×
        </span>
      ) : null}
    </button>
  );
}
