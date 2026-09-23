import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { collectReferencedAssetIds } from '../../../domain/assets/assetUsage';
import type { Asset, ProjectDocument, TranscriptRecording } from '../../../domain/documents/model';
import { localMediaImportConfig } from '../media/localMediaImportConfig';

interface AssetsPanelProps {
  onImportImage?: ((file: File) => void) | undefined;
  onImportMedia?: ((file: File) => void) | undefined;
  onRemoveAsset?: ((assetId: string) => void) | undefined;
  onRemoveRecording?: ((recordingId: string) => void) | undefined;
  onRemoveRecordingAudio?: ((recordingId: string) => void) | undefined;
  onRemoveTranscript?: ((recordingId: string) => void) | undefined;
  project: ProjectDocument;
}

const openableFileProtocols = new Set(['blob:', 'data:', 'https:']);
const transcriptFileRevokeDelayMs = 60_000;

export function AssetsPanel({
  onImportImage,
  onImportMedia,
  onRemoveAsset,
  onRemoveRecording,
  onRemoveRecordingAudio,
  onRemoveTranscript,
  project,
}: AssetsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const assetRows = useMemo(() => {
    const referencedAssetIds = collectReferencedAssetIds(project);
    return Object.values(project.assets)
      .map((asset) => ({
        asset,
        used: referencedAssetIds.has(asset.id),
      }))
      .sort((a, b) => a.asset.name.localeCompare(b.asset.name, undefined, { sensitivity: 'base' }));
  }, [project]);
  const recordings = useMemo(() => {
    const pageIds = new Set(project.pages.map((page) => page.id));
    return Object.values(project.recordings ?? {})
      .map((recording) => ({
        recording,
        used: isRecordingUsed(recording, pageIds),
      }))
      .sort((a, b) => Date.parse(b.recording.createdAt) - Date.parse(a.recording.createdAt));
  }, [project.pages, project.recordings]);
  const unusedAssets = assetRows.filter((row) => !row.used);
  const usedAssets = assetRows.filter((row) => row.used);
  const unusedRecordings = recordings.filter((row) => !row.used);
  const usedRecordings = recordings.filter((row) => row.used);

  return (
    <section className="panel-stack" aria-label="Project assets">
      <div className="panel-section ew-panel-card">
        <h2 className="panel-heading">Assets</h2>
        <p className="panel-muted">Media, recordings, and transcripts in this project.</p>
      </div>
      <button
        className="compact-action compact-action-full ew-surface ew-surface-hover ew-compact-row"
        type="button"
        onClick={() => {
          fileInputRef.current?.click();
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          add_photo_alternate
        </span>
        Import Media
      </button>
      <input
        ref={fileInputRef}
        aria-label="Import media file"
        className="visually-hidden-input"
        type="file"
        accept={localMediaImportConfig.accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (onImportMedia) {
            onImportMedia(file);
          } else {
            onImportImage?.(file);
          }
          setMediaOpen(true);
          event.target.value = '';
        }}
      />
      <AssetDisclosure
        count={assetRows.length}
        label="Media"
        open={mediaOpen}
        onToggle={() => {
          setMediaOpen((open) => !open);
        }}
      >
        {assetRows.length > 0 ? (
          [...unusedAssets, ...usedAssets].map(({ asset, used }, index) => (
            <div className="asset-usage-item" key={asset.id}>
              {index === 0 && unusedAssets.length > 0 ? <UsageSplit label="Unused media" /> : null}
              <AssetRow asset={asset} used={used} onRemoveAsset={onRemoveAsset} />
            </div>
          ))
        ) : (
          <p className="panel-muted">No assets imported yet.</p>
        )}
      </AssetDisclosure>
      <AssetDisclosure
        count={recordings.length}
        label="Recordings"
        open={recordingsOpen}
        onToggle={() => {
          setRecordingsOpen((open) => !open);
        }}
      >
        {recordings.length > 0 ? (
          [...unusedRecordings, ...usedRecordings].map(({ recording }, index) => (
            <div className="asset-usage-item" key={recording.id}>
              {index === 0 && unusedRecordings.length > 0 ? (
                <UsageSplit label="Unused recordings" />
              ) : null}
              <RecordingGroup
                recording={recording}
                onRemoveRecording={onRemoveRecording}
                onRemoveRecordingAudio={onRemoveRecordingAudio}
                onRemoveTranscript={onRemoveTranscript}
              />
            </div>
          ))
        ) : (
          <p className="panel-muted">No recordings yet.</p>
        )}
      </AssetDisclosure>
    </section>
  );
}

function AssetDisclosure({
  children,
  count,
  label,
  onToggle,
  open,
}: {
  children: ReactNode;
  count: number;
  label: string;
  onToggle: () => void;
  open: boolean;
}) {
  const panelId = useId();

  return (
    <div className="asset-list ew-panel-card">
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={`${label}, ${count}`}
        className="asset-disclosure-toggle"
        type="button"
        onClick={onToggle}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {open ? 'expand_less' : 'expand_more'}
        </span>
        <span className="panel-section-title">{label}</span>
        <span className="asset-disclosure-count">{count}</span>
      </button>
      {open ? (
        <div className="asset-disclosure-panel" id={panelId}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

function UsageSplit({ label }: { label: string }) {
  return (
    <div className="asset-usage-split" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}

function isRecordingUsed(recording: TranscriptRecording, pageIds: Set<string>) {
  if (recording.audio.publicShareAuthorized) return true;
  return recording.segments.some((segment) =>
    Boolean(segment.pageId && pageIds.has(segment.pageId)),
  );
}

function AssetRow({
  asset,
  onRemoveAsset,
  used,
}: {
  asset: Asset;
  onRemoveAsset: ((assetId: string) => void) | undefined;
  used: boolean;
}) {
  const detail = asset.fileName ?? asset.id;
  const storageLabel =
    asset.storage === 'file' ? 'Saved file' : asset.storage === 'remote' ? 'Remote' : 'Inline';
  const openUrl = getOpenableFileUrl(asset.objectUrl);
  const showImage = Boolean(openUrl) && (asset.type === 'image' || asset.type === 'gif');

  return (
    <div className="asset-row ew-surface ew-surface-hover">
      <div className="asset-thumb" aria-hidden="true">
        {showImage ? (
          <img alt="" src={openUrl} />
        ) : (
          <span className="material-symbols-outlined">
            {asset.type === 'video' ? 'movie' : 'image'}
          </span>
        )}
      </div>
      <div className="asset-row-body">
        <div className="asset-row-title-line ew-compact-row">
          <h3 className="asset-row-title ew-ellipsis">{asset.name}</h3>
          <span
            className={used ? 'asset-status asset-status-used' : 'asset-status asset-status-unused'}
          >
            {used ? 'Used' : 'Unused'}
          </span>
        </div>
        <p className="asset-row-meta ew-ellipsis">
          {asset.mimeType} · {storageLabel}
        </p>
        <p className="asset-row-meta ew-ellipsis">{detail}</p>
      </div>
      <div className="asset-row-actions">
        <FileLinkButton label={`Open ${asset.name} in a new tab`} url={openUrl} />
        <button
          aria-label={`Remove ${asset.name}`}
          className="asset-icon-button asset-remove-button"
          disabled={used || !onRemoveAsset}
          title={used ? 'This asset is still used in the project' : 'Remove unused asset'}
          type="button"
          onClick={() => {
            onRemoveAsset?.(asset.id);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            delete
          </span>
        </button>
      </div>
    </div>
  );
}

function RecordingGroup({
  onRemoveRecording,
  onRemoveRecordingAudio,
  onRemoveTranscript,
  recording,
}: {
  onRemoveRecording: ((recordingId: string) => void) | undefined;
  onRemoveRecordingAudio: ((recordingId: string) => void) | undefined;
  onRemoveTranscript: ((recordingId: string) => void) | undefined;
  recording: TranscriptRecording;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const hasTranscript = recording.segments.length > 0 || Boolean(recording.transcriptFileName);
  const hasAudio = Boolean(
    recording.audio.fileName || recording.audio.objectUrl || recording.audio.storage === 'file',
  );
  const createdAtLabel = formatCreatedAt(recording.createdAt);

  return (
    <div className="asset-group ew-surface" aria-label={`Recording ${recording.name}`}>
      <div className="asset-group-header">
        <button
          aria-controls={panelId}
          aria-expanded={open}
          aria-label={`${recording.name}, ${formatDuration(recording.durationMs)}`}
          className="asset-disclosure-toggle asset-group-toggle"
          type="button"
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {open ? 'expand_less' : 'expand_more'}
          </span>
          <span className="asset-row-title ew-ellipsis">{recording.name}</span>
          <span className="asset-row-meta">{formatDuration(recording.durationMs)}</span>
        </button>
        <button
          aria-label={`Remove ${recording.name} recording and transcript`}
          className="asset-icon-button asset-remove-button"
          disabled={!onRemoveRecording}
          title="Remove recording and transcript"
          type="button"
          onClick={() => {
            onRemoveRecording?.(recording.id);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            delete
          </span>
        </button>
      </div>
      {open ? (
        <ul className="asset-sublist" id={panelId}>
          {hasAudio ? (
            <li>
              <AssetFileRow
                detail={createdAtLabel}
                icon="mic"
                openLabel={`Open ${recording.name} recording in a new tab`}
                removeLabel={`Remove ${recording.name} recording`}
                removeTitle="Remove recording only"
                title="Recording"
                url={getOpenableFileUrl(recording.audio.objectUrl)}
                onRemove={
                  onRemoveRecordingAudio
                    ? () => {
                        onRemoveRecordingAudio(recording.id);
                      }
                    : undefined
                }
              />
            </li>
          ) : null}
          {hasTranscript ? (
            <li>
              <AssetFileRow
                detail={createdAtLabel}
                icon="subtitles"
                openLabel={`Open ${recording.name} transcript in a new tab`}
                removeLabel={`Remove ${recording.name} transcript`}
                removeTitle="Remove transcript only"
                title="Transcript"
                onOpen={
                  recording.segments.length > 0
                    ? () => {
                        openTranscriptFile(recording);
                      }
                    : undefined
                }
                onRemove={
                  onRemoveTranscript
                    ? () => {
                        onRemoveTranscript(recording.id);
                      }
                    : undefined
                }
              />
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function AssetFileRow({
  detail,
  icon,
  onOpen,
  onRemove,
  openLabel,
  removeLabel,
  removeTitle,
  title,
  url,
}: {
  detail: string;
  icon: string;
  onOpen?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
  openLabel: string;
  removeLabel?: string | undefined;
  removeTitle?: string | undefined;
  title: string;
  url?: string | undefined;
}) {
  return (
    <div className="asset-subrow">
      <span className="material-symbols-outlined asset-subrow-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="asset-row-body">
        <h4 className="asset-row-title ew-ellipsis">{title}</h4>
        <p className="asset-row-meta ew-ellipsis">{detail}</p>
      </div>
      <div className="asset-row-actions">
        <FileLinkButton label={openLabel} url={url} onOpen={onOpen} />
        {removeLabel ? (
          <button
            aria-label={removeLabel}
            className="asset-icon-button asset-remove-button"
            disabled={!onRemove}
            title={removeTitle ?? removeLabel}
            type="button"
            onClick={() => {
              onRemove?.();
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              delete
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FileLinkButton({
  label,
  onOpen,
  url,
}: {
  label: string;
  onOpen?: (() => void) | undefined;
  url?: string | undefined;
}) {
  if (url) {
    return (
      <a
        aria-label={label}
        className="asset-icon-button asset-link-button"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
        title={label}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          link
        </span>
      </a>
    );
  }

  return (
    <button
      aria-label={label}
      className="asset-icon-button asset-link-button"
      disabled={!onOpen}
      title={onOpen ? label : 'This file is not available to open'}
      type="button"
      onClick={() => {
        onOpen?.();
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        link
      </span>
    </button>
  );
}

function getOpenableFileUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return openableFileProtocols.has(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

function openTranscriptFile(recording: TranscriptRecording) {
  const payload = {
    schemaVersion: 1,
    recordingId: recording.id,
    segments: recording.segments,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  anchor.target = '_blank';
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, transcriptFileRevokeDelayMs);
}
