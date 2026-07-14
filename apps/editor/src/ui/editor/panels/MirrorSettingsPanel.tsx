import { useEffect, useRef, useState } from 'react';
import type {
  LocalFontMirrorProgress,
  LocalFontMirrorSettings,
  MirrorState,
} from '../../../services/contracts/interfaces';
import type { MinioMirrorConfig } from '../../../services/mirror/minioMirrorService';

interface MirrorSettingsPanelProps {
  config: MinioMirrorConfig;
  localFontMirrorSettings: LocalFontMirrorSettings;
  mirrorState: MirrorState;
  mirrorDisabledBySettings?: boolean;
  onBack?: () => void;
  onChooseLocalFontFolder: () => Promise<void>;
  onClose: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onLocalFontMirrorEnabledChange: (enabled: boolean) => void;
  onSave: (config: MinioMirrorConfig) => void;
  onTestConnection: (
    config: MinioMirrorConfig,
    options?: { onProgress?: (progress: LocalFontMirrorProgress) => void },
  ) => void | Promise<string | void>;
}

export function MirrorSettingsPanel({
  config,
  localFontMirrorSettings,
  mirrorState,
  mirrorDisabledBySettings = false,
  onBack,
  onChooseLocalFontFolder,
  onClose,
  onEnabledChange,
  onLocalFontMirrorEnabledChange,
  onSave,
  onTestConnection,
}: MirrorSettingsPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState(config);
  const [secretVisible, setSecretVisible] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ready' | 'failed'>(
    'idle',
  );
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [connectionDetail, setConnectionDetail] = useState<string | undefined>();
  const [folderStatus, setFolderStatus] = useState<'idle' | 'choosing' | 'failed'>('idle');
  const [folderError, setFolderError] = useState<string | undefined>();

  function updateDraft(patch: Partial<MinioMirrorConfig>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function normalizedDraft(): MinioMirrorConfig {
    return {
      ...draft,
      accessKey: draft.accessKey.trim(),
      bucket: draft.bucket.trim(),
      endpoint: draft.endpoint.trim().replace(/\/+$/g, ''),
      publicBaseUrl: draft.publicBaseUrl.trim().replace(/\/+$/g, ''),
      region: draft.region.trim() || 'us-east-1',
      prefix: draft.prefix.trim(),
    };
  }

  async function testConnection() {
    setConnectionStatus('testing');
    setConnectionError(undefined);
    setConnectionDetail('Checking storage');
    try {
      const warning = await onTestConnection(normalizedDraft(), {
        onProgress: (progress) => setConnectionDetail(progress.label),
      });
      setConnectionStatus('ready');
      setConnectionDetail(warning ?? undefined);
    } catch (error) {
      setConnectionStatus('failed');
      setConnectionError(
        error instanceof Error ? error.message : 'S3-compatible connection failed.',
      );
      setConnectionDetail(undefined);
    }
  }

  async function chooseFontFolder() {
    setFolderStatus('choosing');
    setFolderError(undefined);
    try {
      await onChooseLocalFontFolder();
    } catch (error) {
      setFolderStatus('failed');
      setFolderError(error instanceof Error ? error.message : 'Could not choose font folder.');
      return;
    }
    setFolderStatus('idle');
  }

  async function setLocalFontMirroringEnabled(enabled: boolean) {
    if (!enabled) {
      onLocalFontMirrorEnabledChange(false);
      return;
    }
    await chooseFontFolder();
  }

  const publicBucketUrl = `${draft.endpoint.replace(/\/+$/g, '')}/${draft.bucket.trim()}`;
  const consoleUrl = draft.endpoint.replace(/\/+$/g, '');

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
      className="mirror-settings-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Mirror settings"
      data-tour-id="mirror-settings-panel"
    >
      <div className="mirror-settings-header ew-split-row-start">
        <div className="settings-panel-title-row">
          {onBack ? (
            <button
              className="stitch-icon-button settings-panel-back-button"
              type="button"
              aria-label="Back to settings"
              onClick={onBack}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_back
              </span>
            </button>
          ) : null}
          <div>
            <h2>Mirror settings</h2>
            <p>Sync this local project folder to S3-compatible storage.</p>
          </div>
        </div>
        <button
          className="stitch-icon-button"
          type="button"
          aria-label="Close mirror settings"
          onClick={onClose}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>

      <section className="mirror-settings-section" aria-label="Mirror project storage">
        <div className="mirror-settings-section-heading">
          <div>
            <h3>Mirror project storage</h3>
            <p>Store public deck assets in an S3-compatible bucket.</p>
          </div>
        </div>

        <div className="mirror-settings-grid ew-field-scope" data-tour-id="mirror-settings-fields">
          <label>
            <span>Endpoint</span>
            <input
              value={draft.endpoint}
              onChange={(event) => updateDraft({ endpoint: event.target.value })}
            />
          </label>
          <label>
            <span>Bucket</span>
            <input
              value={draft.bucket}
              onChange={(event) => updateDraft({ bucket: event.target.value })}
            />
          </label>
          <label>
            <span>Region</span>
            <input
              value={draft.region}
              onChange={(event) => updateDraft({ region: event.target.value })}
            />
          </label>
          <label>
            <span>Access key</span>
            <input
              value={draft.accessKey}
              onChange={(event) => updateDraft({ accessKey: event.target.value })}
            />
          </label>
          <label>
            <span>Secret key</span>
            <span className="mirror-secret-control">
              <input
                aria-label="Secret key"
                type={secretVisible ? 'text' : 'password'}
                value={draft.secretKey}
                onChange={(event) => updateDraft({ secretKey: event.target.value })}
              />
              <button
                className="stitch-icon-button mirror-secret-toggle"
                type="button"
                aria-label={secretVisible ? 'Hide secret key' : 'Show secret key'}
                onClick={() => setSecretVisible((current) => !current)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {secretVisible ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </span>
          </label>
          <label>
            <span>Public base URL</span>
            <input
              value={draft.publicBaseUrl}
              onChange={(event) => updateDraft({ publicBaseUrl: event.target.value })}
            />
          </label>
          <label>
            <span>Prefix</span>
            <input
              value={draft.prefix}
              onChange={(event) => updateDraft({ prefix: event.target.value })}
            />
          </label>
          <label className="mirror-checkbox-row">
            <input
              checked={draft.pathStyle}
              type="checkbox"
              onChange={(event) => updateDraft({ pathStyle: event.target.checked })}
            />
            <span>Path-style URLs</span>
          </label>
        </div>

        <p
          className={
            mirrorState.status === 'failed' || connectionStatus === 'failed'
              ? 'mirror-settings-status mirror-settings-status-error'
              : 'mirror-settings-status'
          }
        >
          {connectionStatus === 'ready' ? (
            <>
              <span className="material-symbols-outlined" aria-hidden="true">
                check_circle
              </span>
              S3-compatible connection is ready.
            </>
          ) : connectionStatus === 'failed' ? (
            connectionError
          ) : mirrorState.status === 'failed' ? (
            (mirrorState.error ?? 'S3-compatible connection failed.')
          ) : mirrorState.status === 'syncing' || connectionStatus === 'testing' ? (
            'Checking S3-compatible connection...'
          ) : mirrorState.status === 'synced' ? (
            'S3-compatible connection is ready.'
          ) : (
            'Keys are stored in this browser profile.'
          )}
        </p>

        <div className="mirror-settings-help">
          <p>Local S3-compatible default login: localstudio / localstudio123</p>
          {connectionStatus === 'ready' ? (
            <div className="mirror-settings-links">
              <a href={publicBucketUrl} target="_blank" rel="noreferrer">
                Open public bucket
              </a>
              <a href={consoleUrl} target="_blank" rel="noreferrer">
                Open storage console
              </a>
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="mirror-settings-section mirror-settings-fonts"
        aria-label="Local font mirroring"
      >
        <div className="mirror-settings-section-heading">
          <div>
            <h3>Mirror my local fonts</h3>
            <p>
              LocalStudio can use fonts installed on this machine while editing. Public viewers need
              those font files mirrored to storage before they can see the same typography.
            </p>
          </div>
          <label className="mirror-settings-font-toggle">
            <input
              checked={localFontMirrorSettings.enabled}
              type="checkbox"
              onChange={(event) => void setLocalFontMirroringEnabled(event.target.checked)}
            />
            <span aria-hidden="true" className="mirror-settings-font-toggle-track">
              <span className="mirror-settings-font-toggle-thumb" />
            </span>
            <span>{localFontMirrorSettings.enabled ? 'Enabled' : 'Off'}</span>
          </label>
        </div>
        <div className="mirror-settings-font-hint">
          <span className="material-symbols-outlined" aria-hidden="true">
            travel_explore
          </span>
          <span>
            Usual font folder for this system: <strong>{localFontMirrorSettings.systemHint}</strong>
          </span>
        </div>
        <div className="mirror-settings-font-actions">
          <button
            className="mirror-settings-font-action"
            type="button"
            disabled={!localFontMirrorSettings.supported || folderStatus === 'choosing'}
            onClick={() => void chooseFontFolder()}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              folder_open
            </span>
            <span>
              {folderStatus === 'choosing'
                ? 'Choosing font folder...'
                : localFontMirrorSettings.folderLabel
                  ? `Folder: ${localFontMirrorSettings.folderLabel}`
                  : 'Choose font folder'}
            </span>
          </button>
          {!localFontMirrorSettings.supported ? (
            <span className="mirror-settings-font-warning">
              This browser cannot remember a local font folder.
            </span>
          ) : null}
          {folderError ? <span className="mirror-settings-font-warning">{folderError}</span> : null}
        </div>
      </section>

      <div className="mirror-settings-actions" data-tour-id="mirror-settings-actions">
        <button
          className={
            mirrorState.enabled
              ? 'footer-toggle mirror-settings-toggle-danger'
              : 'footer-toggle mirror-settings-toggle-success'
          }
          type="button"
          onClick={() => {
            const nextEnabled = !mirrorState.enabled;
            onEnabledChange(nextEnabled);
            if (nextEnabled) void testConnection();
          }}
        >
          {mirrorState.enabled ? 'Disable mirroring' : 'Enable mirroring'}
        </button>
        <button className="footer-toggle" type="button" onClick={() => void testConnection()}>
          {connectionStatus === 'testing'
            ? (connectionDetail ?? 'Checking S3-compatible connection...')
            : 'Test connection'}
        </button>
        <button
          className="export-button font-orbitron"
          disabled={mirrorDisabledBySettings}
          type="button"
          onClick={() => onSave(normalizedDraft())}
        >
          Save settings
        </button>
      </div>
      {connectionStatus === 'ready' && connectionDetail ? (
        <p className="mirror-settings-status">{connectionDetail}</p>
      ) : null}
    </aside>
  );
}
