import { useState } from 'react';
import type { StockMediaConfig } from '../../../services/contracts/interfaces';

interface MediaIntegrationSettingsPanelProps {
  config: StockMediaConfig | null;
  onBack?: () => void;
  onClear?: () => void;
  onClose: () => void;
  onSave: (config: StockMediaConfig) => void;
}

export function MediaIntegrationSettingsPanel({
  config,
  onBack,
  onClear,
  onClose,
  onSave,
}: MediaIntegrationSettingsPanelProps) {
  const [unsplashAccessKey, setUnsplashAccessKey] = useState(config?.unsplashAccessKey ?? '');
  const [giphyApiKey, setGiphyApiKey] = useState(config?.giphyApiKey ?? '');
  const [unsplashVisible, setUnsplashVisible] = useState(false);
  const [giphyVisible, setGiphyVisible] = useState(false);
  const unsplashConfigured = Boolean(config?.unsplashAccessKey);
  const giphyConfigured = Boolean(config?.giphyApiKey);

  return (
    <aside
      className="settings-panel media-integration-settings-panel"
      role="dialog"
      aria-modal="false"
      aria-label="Media integrations"
      data-tour-id="media-integrations-panel"
    >
      <div className="settings-panel-header ew-split-row-start">
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
            <h2>Media integrations</h2>
            <p>Connect Unsplash images and GIPHY GIFs in the Elements panel.</p>
          </div>
        </div>
        <button
          className="stitch-icon-button"
          type="button"
          aria-label="Close media integrations"
          onClick={onClose}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>
      <form
        className="media-integration-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            giphyApiKey: giphyApiKey.trim(),
            unsplashAccessKey: unsplashAccessKey.trim(),
          });
        }}
      >
        <label className="media-key-field ew-field-scope" data-tour-id="unsplash-config">
          <span className="media-key-label">
            <span>Unsplash access key</span>
            <a
              href="https://unsplash.com/documentation?utm_source=localstudio.dev#creating-a-developer-account"
              target="_blank"
              rel="noreferrer"
              aria-label="See how to get an Unsplash access key"
            >
              See how
            </a>
          </span>
          <span className="mirror-secret-control">
            <input
              aria-label="Unsplash access key"
              autoComplete="off"
              type={unsplashVisible ? 'text' : 'password'}
              value={unsplashAccessKey}
              placeholder="Paste Unsplash access key"
              onChange={(event) => {
                setUnsplashAccessKey(event.target.value);
              }}
            />
            <button
              className="stitch-icon-button mirror-secret-toggle"
              type="button"
              aria-label={unsplashVisible ? 'Hide Unsplash access key' : 'Show Unsplash access key'}
              onClick={() => setUnsplashVisible((current) => !current)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {unsplashVisible ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </span>
          <small>{unsplashConfigured ? 'Unsplash configured' : 'Unsplash not configured'}</small>
        </label>
        <label className="media-key-field ew-field-scope" data-tour-id="giphy-config">
          <span className="media-key-label">
            <span>GIPHY API key</span>
            <a
              href="https://developers.giphy.com/docs/api/?utm_source=localstudio.dev#quick-start-guide"
              target="_blank"
              rel="noreferrer"
              aria-label="See how to get a GIPHY API key"
            >
              See how
            </a>
          </span>
          <span className="mirror-secret-control">
            <input
              aria-label="GIPHY API key"
              autoComplete="off"
              type={giphyVisible ? 'text' : 'password'}
              value={giphyApiKey}
              placeholder="Paste GIPHY API key"
              onChange={(event) => {
                setGiphyApiKey(event.target.value);
              }}
            />
            <button
              className="stitch-icon-button mirror-secret-toggle"
              type="button"
              aria-label={giphyVisible ? 'Hide GIPHY API key' : 'Show GIPHY API key'}
              onClick={() => setGiphyVisible((current) => !current)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {giphyVisible ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </span>
          <small>{giphyConfigured ? 'GIPHY configured' : 'GIPHY not configured'}</small>
        </label>
        <div className="mirror-settings-help">
          <p>Provider keys stay in this browser profile.</p>
        </div>
        <div className="media-integration-actions" data-tour-id="media-integrations-actions">
          <button className="export-button font-orbitron" type="submit">
            Save media integrations
          </button>
          <button
            className="compact-action compact-action-secondary ew-surface ew-surface-hover ew-compact-row"
            type="button"
            disabled={!config || (!unsplashConfigured && !giphyConfigured)}
            onClick={() => {
              onClear?.();
              setUnsplashAccessKey('');
              setGiphyApiKey('');
              setUnsplashVisible(false);
              setGiphyVisible(false);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              key_off
            </span>
            Clear media integrations
          </button>
        </div>
      </form>
    </aside>
  );
}
