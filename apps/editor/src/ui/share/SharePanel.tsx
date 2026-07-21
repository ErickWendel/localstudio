import { useState } from 'react';
import type {
  ShareMetadata,
  SharePublishProgress,
} from '../../services/contracts/interfaces';
import { copyShareText } from './shareClipboard';

export interface ShareRecordingOption {
  id: string;
  label: string;
  segmentCount: number;
}

interface SharePanelProps {
  projectName: string;
  recordingOptions?: ShareRecordingOption[] | undefined;
  share?: ShareMetadata | undefined;
  publicLinkUnavailableReason?: string | undefined;
  shareProgress?: SharePublishProgress | undefined;
  onClose: () => void;
  onConfigurePublicLink?: () => void;
  onCopyLink: (selectedRecordingId?: string) => Promise<ShareMetadata>;
  onDownload: () => void;
  onPresent: () => void;
}

function getStatusLabel(share: ShareMetadata | undefined, isCopying: boolean) {
  if (isCopying) return 'Copying link...';
  if (!share) return 'Not shared yet';
  if (share.status === 'copied') return 'Copied';
  if (share.status === 'syncing') return 'Syncing';
  if (share.status === 'sync-failed') return 'Sync failed';
  return 'Published';
}

export function SharePanel({
  projectName,
  recordingOptions = [],
  share,
  publicLinkUnavailableReason,
  shareProgress,
  onClose,
  onConfigurePublicLink,
  onCopyLink,
  onDownload,
  onPresent,
}: SharePanelProps) {
  const defaultRecordingId = recordingOptions[0]?.id;
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | undefined>(defaultRecordingId);
  const [lastCopiedShare, setLastCopiedShare] = useState<ShareMetadata | undefined>();
  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | undefined>();
  const currentShare = share ?? lastCopiedShare;
  const publicLinkUnavailable = Boolean(publicLinkUnavailableReason);
  const statusLabel = getStatusLabel(currentShare, isCopying);
  const progressPercent = shareProgress
    ? Math.round((shareProgress.current / shareProgress.total) * 100)
    : 0;
  const shareAccessDescription =
    copyError ??
    shareProgress?.label ??
    publicLinkUnavailableReason ??
    (currentShare
      ? 'Unlisted: anyone with the link can view.'
      : 'Sync the deck to prepare a public view link.');
  const showRecordingPicker = recordingOptions.length > 1;
  const activeSelectedRecordingId =
    selectedRecordingId && recordingOptions.some((recording) => recording.id === selectedRecordingId)
      ? selectedRecordingId
      : defaultRecordingId;

  async function handleCopyLink() {
    if (publicLinkUnavailable) {
      onConfigurePublicLink?.();
      return;
    }
    setIsCopying(true);
    setCopyError(undefined);
    try {
      const nextShare = await onCopyLink(activeSelectedRecordingId);
      setLastCopiedShare(nextShare);
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
      <div className="share-panel-header ew-split-row-start">
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
        {shareProgress ? (
          <div
            className="share-publish-progress"
            role="progressbar"
            aria-label="Share publish progress"
            aria-valuemin={0}
            aria-valuemax={shareProgress.total}
            aria-valuenow={shareProgress.current}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        ) : null}
        <p className="share-access-note">
          Public links should use a read-only storage key so viewers cannot write or modify
          presentations.
        </p>
      </section>

      <button
        className="share-copy-link-button font-orbitron"
        type="button"
        data-loading={isCopying ? 'true' : 'false'}
        disabled={isCopying}
        title={publicLinkUnavailableReason}
        onClick={() => {
          void handleCopyLink();
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          link
        </span>
        {publicLinkUnavailable ? 'Configure mirror storage' : 'Copy link'}
      </button>

      {showRecordingPicker ? (
        <label className="share-recording-picker">
          Recording for public share
          <select
            value={activeSelectedRecordingId ?? ''}
            disabled={isCopying}
            onChange={(event) => setSelectedRecordingId(event.target.value || undefined)}
          >
            {recordingOptions.map((recording) => (
              <option key={recording.id} value={recording.id}>
                {recording.label} · {recording.segmentCount} transcript segments
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
            copyShareText(currentShare.embedHtml);
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
