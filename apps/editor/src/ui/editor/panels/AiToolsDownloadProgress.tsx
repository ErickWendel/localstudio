import type { ModelDownloadProgressDetails } from '../../../services/contracts/interfaces';

export type AiToolsDownloadProgressStatus = 'idle' | 'downloading' | 'ready' | 'failed';

function hasByteProgress(details: ModelDownloadProgressDetails) {
  return (
    typeof details.loadedBytes === 'number' &&
    typeof details.totalBytes === 'number' &&
    Number.isFinite(details.loadedBytes) &&
    Number.isFinite(details.totalBytes) &&
    details.totalBytes > 0
  );
}

function formatGigabytes(bytes: number) {
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

function formatRemainingTime(estimatedRemainingMs: number | undefined) {
  if (
    typeof estimatedRemainingMs !== 'number' ||
    !Number.isFinite(estimatedRemainingMs) ||
    estimatedRemainingMs <= 0
  ) {
    return undefined;
  }

  const totalSeconds = Math.max(1, Math.ceil(estimatedRemainingMs / 1_000));
  if (totalSeconds < 60) return 'Less than 1 min remaining';

  const minutes = Math.ceil(totalSeconds / 60);
  return `About ${minutes} min remaining`;
}

function getPrimaryProgressText(
  status: AiToolsDownloadProgressStatus,
  details: ModelDownloadProgressDetails & { progress: number },
  progress: number,
) {
  if (status !== 'downloading') return undefined;
  if (hasByteProgress(details)) {
    return `${formatGigabytes(details.loadedBytes!)} / ${formatGigabytes(details.totalBytes!)} (${progress}%)`;
  }
  if (progress >= 98) return undefined;
  return `${progress}%`;
}

function getSecondaryProgressText(
  status: AiToolsDownloadProgressStatus,
  details: ModelDownloadProgressDetails & { progress: number },
) {
  if (status !== 'downloading') return undefined;
  if (details.progress >= 98) return 'Finalizing...';
  return formatRemainingTime(details.estimatedRemainingMs);
}

export function AiToolsDownloadProgress({
  details,
  status,
}: {
  details: ModelDownloadProgressDetails & { progress: number };
  status: AiToolsDownloadProgressStatus;
}) {
  const progress = Math.max(0, Math.min(100, Math.round(details.progress)));
  const primary = getPrimaryProgressText(status, details, progress);
  const secondary = getSecondaryProgressText(status, details);
  if (!primary && !secondary) return null;

  return (
    <span className="download-progress-copy">
      {primary ? <span className="download-progress-primary">{primary}</span> : null}
      {secondary ? <span className="download-progress-secondary">{secondary}</span> : null}
    </span>
  );
}
