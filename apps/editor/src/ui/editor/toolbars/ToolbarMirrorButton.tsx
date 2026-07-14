import type { MirrorState } from '../../../services/contracts/interfaces';

interface ToolbarMirrorButtonProps {
  mirrorDisabledBySettings: boolean;
  mirrorState: MirrorState;
  persistenceEnabled: boolean;
  onMirrorNow: (() => void) | undefined;
  onMirrorToggle: ((enabled: boolean) => void) | undefined;
  onOpenMirrorSettings: (() => void) | undefined;
}

export function ToolbarMirrorButton({
  mirrorDisabledBySettings,
  mirrorState,
  persistenceEnabled,
  onMirrorNow,
  onMirrorToggle,
  onOpenMirrorSettings,
}: ToolbarMirrorButtonProps) {
  const needsLocalSave = !persistenceEnabled;
  const label = needsLocalSave
    ? 'Save deck before mirroring'
    : !mirrorState.enabled
      ? 'Mirror disabled'
      : mirrorState.status === 'syncing'
        ? 'Mirror syncing'
        : mirrorState.status === 'synced'
          ? 'Mirror up to date'
          : mirrorState.status === 'failed'
            ? 'Mirror failed'
            : 'Mirror ready';
  const className = [
    'stitch-icon-button',
    'mirror-status-button',
    needsLocalSave ? 'mirror-needs-save' : '',
    !needsLocalSave && !mirrorState.enabled ? 'mirror-disabled' : '',
    !needsLocalSave && mirrorState.status === 'syncing' ? 'mirror-syncing' : '',
    !needsLocalSave && mirrorState.status === 'synced' ? 'mirror-synced' : '',
    !needsLocalSave && mirrorState.status === 'failed' ? 'mirror-failed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={className}
      title={mirrorState.error ?? label}
      type="button"
      aria-label={label}
      data-tour-id="mirror-status"
      onClick={() => {
        if (needsLocalSave) {
          onMirrorNow?.();
          return;
        }
        if (mirrorDisabledBySettings) {
          onOpenMirrorSettings?.();
          return;
        }
        if (mirrorState.enabled) {
          onMirrorToggle?.(false);
          return;
        }
        onMirrorNow?.();
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {mirrorState.status === 'syncing' ? 'sync' : 'cloud_sync'}
      </span>
    </button>
  );
}
