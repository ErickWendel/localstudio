import { useEffect, useRef, useState } from 'react';
import type { MirrorState } from '../../../services/contracts/interfaces';
import type { MinioMirrorConfig } from '../../../services/mirror/minioMirrorService';

interface MirrorSettingsPanelProps {
  config: MinioMirrorConfig;
  mirrorState: MirrorState;
  mirrorDisabledBySettings?: boolean;
  onClose: () => void;
  onEnabledChange: (enabled: boolean) => void;
  onSave: (config: MinioMirrorConfig) => void;
  onTestConnection: (config: MinioMirrorConfig) => void | Promise<void>;
}

export function MirrorSettingsPanel({
  config,
  mirrorState,
  mirrorDisabledBySettings = false,
  onClose,
  onEnabledChange,
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
    try {
      await onTestConnection(normalizedDraft());
      setConnectionStatus('ready');
    } catch (error) {
      setConnectionStatus('failed');
      setConnectionError(error instanceof Error ? error.message : 'MinIO connection failed.');
    }
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
    >
      <div className="mirror-settings-header">
        <div>
          <h2>Mirror settings</h2>
          <p>Sync this local project folder to MinIO.</p>
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

      <div className="mirror-settings-grid">
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
            Connection is ready.
          </>
        ) : connectionStatus === 'failed' ? (
          connectionError
        ) : mirrorState.status === 'failed' ? (
          (mirrorState.error ?? 'MinIO connection failed.')
        ) : mirrorState.status === 'syncing' || connectionStatus === 'testing' ? (
          'Checking MinIO connection...'
        ) : mirrorState.status === 'synced' ? (
          'MinIO connection is ready.'
        ) : (
          'Keys are stored in this browser profile.'
        )}
      </p>

      <div className="mirror-settings-help">
        <p>Default MinIO login: localstudio / localstudio123</p>
        {connectionStatus === 'ready' ? (
          <div className="mirror-settings-links">
            <a href={publicBucketUrl} target="_blank" rel="noreferrer">
              Open public bucket
            </a>
            <a href={consoleUrl} target="_blank" rel="noreferrer">
              Open MinIO console
            </a>
          </div>
        ) : null}
      </div>

      <div className="mirror-settings-actions">
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
          {connectionStatus === 'testing' ? 'Checking MinIO connection...' : 'Test connection'}
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
    </aside>
  );
}
