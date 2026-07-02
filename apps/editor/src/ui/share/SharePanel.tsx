import { useState } from 'react';
import type { ShareMetadata } from '../../services/contracts/interfaces';

interface SharePanelProps {
  projectName: string;
  share?: ShareMetadata | undefined;
  publicLinkUnavailableReason?: string | undefined;
  onClose: () => void;
  onCopyLink: () => Promise<ShareMetadata>;
  onDownload: () => void;
  onPresent: () => void;
}

function getStatusLabel(share: ShareMetadata | undefined, isCopying: boolean) {
  if (isCopying) return 'Creating link...';
  if (!share) return 'Not shared yet';
  if (share.status === 'copied') return 'Copied';
  if (share.status === 'syncing') return 'Syncing';
  if (share.status === 'sync-failed') return 'Sync failed';
  return 'Published';
}

export function SharePanel({
  projectName,
  share,
  publicLinkUnavailableReason,
  onClose,
  onCopyLink,
  onDownload,
  onPresent,
}: SharePanelProps) {
  const [currentShare, setCurrentShare] = useState<ShareMetadata | undefined>(share);
  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | undefined>();
  const publicLinkUnavailable = Boolean(publicLinkUnavailableReason);
  const statusLabel = getStatusLabel(currentShare, isCopying);
  const shareAccessDescription =
    copyError ??
    publicLinkUnavailableReason ??
    (currentShare
      ? 'Unlisted: anyone with the link can view.'
      : 'Create a public view link for this deck.');

  async function handleCopyLink() {
    if (publicLinkUnavailable) return;
    setIsCopying(true);
    setCopyError(undefined);
    try {
      const nextShare = await onCopyLink();
      setCurrentShare(nextShare);
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : 'Could not create the share link.');
    } finally {
      setIsCopying(false);
    }
  }

  function openPublicView() {
    if (!currentShare) return;
    window.open(currentShare.publicUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <aside className="share-panel" aria-label="Share design panel">
      <div className="share-panel-header">
        <div>
          <h2>Share design</h2>
          <p>{projectName}</p>
        </div>
        <button className="stitch-icon-button" type="button" aria-label="Close share panel" onClick={onClose}>
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
      </div>

      <section className="share-access-block" aria-label="Share access">
        <span className="share-status-pill">{copyError ? 'Share failed' : statusLabel}</span>
        <p>{shareAccessDescription}</p>
      </section>

      <button
        className="share-copy-link-button font-orbitron"
        type="button"
        disabled={isCopying || publicLinkUnavailable}
        title={publicLinkUnavailableReason}
        onClick={() => {
          void handleCopyLink();
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          link
        </span>
        Copy link
      </button>

      {currentShare ? (
        <section className="share-link-fields" aria-label="Published share links">
          <label>
            Public URL
            <input readOnly value={currentShare.publicUrl} />
          </label>
          <label>
            Embed code
            <textarea readOnly value={currentShare.embedHtml} />
          </label>
        </section>
      ) : null}

      <div className="share-action-grid" aria-label="Share actions">
        <button className="share-action-button" type="button" onClick={onDownload}>
          <span className="share-action-icon material-symbols-outlined" aria-hidden="true">
            download
          </span>
          Download
        </button>
        <button className="share-action-button share-action-button-accent" type="button" onClick={onPresent}>
          <span className="share-action-icon material-symbols-outlined" aria-hidden="true">
            co_present
          </span>
          Present
        </button>
        <button className="share-action-button" type="button" disabled={!currentShare} onClick={openPublicView}>
          <span className="share-action-icon material-symbols-outlined" aria-hidden="true">
            link
          </span>
          Public view link
        </button>
        <button
          className="share-action-button"
          type="button"
          disabled={!currentShare}
          onClick={() => {
            if (!currentShare) return;
            void navigator.clipboard?.writeText(currentShare.embedHtml);
          }}
        >
          <span className="share-action-icon material-symbols-outlined" aria-hidden="true">
            code
          </span>
          Embed code
        </button>
      </div>
    </aside>
  );
}
