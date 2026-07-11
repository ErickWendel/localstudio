import { Download, X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  AiProviderState,
  ModelDownloadProgressDetails,
} from '../../../services/contracts/interfaces';
import { IconButton } from '../../components/IconButton';
import { StatusPill } from '../../components/StatusPill';
import { AiToolsDownloadProgress } from './AiToolsDownloadProgress';

type PreparationStatus = 'idle' | 'downloading' | 'ready' | 'failed';

function getPreparationLabel(status: PreparationStatus) {
  if (status === 'downloading') return 'Downloading';
  if (status === 'ready') return 'Ready';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

function getPreparationTone(status: PreparationStatus) {
  if (status === 'ready') return 'success';
  if (status === 'downloading') return 'warning';
  return 'neutral';
}

export function AiToolsProviderCard({
  actionLabel,
  ariaLabel,
  attention = false,
  canRemove,
  children,
  description,
  disabledReason,
  icon: Icon,
  isActionDisabled,
  needsDownload,
  onPrepare,
  onProviderChange,
  onRemove,
  preparationAriaLabel,
  preparationDetails,
  preparationNote,
  preparationProgress,
  preparationStatus,
  providerModelId,
  providers,
  runtime,
  selectedProviderId,
  selectLabel,
  shouldShowPreparation = true,
  title,
  tourId,
}: {
  actionLabel: string;
  ariaLabel: string;
  attention?: boolean;
  canRemove: boolean;
  children?: ReactNode;
  description: string;
  disabledReason?: string | undefined;
  icon: LucideIcon;
  isActionDisabled?: boolean | undefined;
  needsDownload: boolean;
  onPrepare?: (() => Promise<void>) | undefined;
  onProviderChange?: ((providerId: string) => void) | undefined;
  onRemove?: ((modelId: string) => Promise<void>) | undefined;
  preparationAriaLabel: string;
  preparationDetails: ModelDownloadProgressDetails & { progress: number };
  preparationNote?: string | undefined;
  preparationProgress: number;
  preparationStatus: PreparationStatus;
  providerModelId?: string | undefined;
  providers: AiProviderState[];
  runtime?: AiProviderState['runtime'] | undefined;
  selectedProviderId: string;
  selectLabel: string;
  shouldShowPreparation?: boolean;
  title: string;
  tourId: string;
}) {
  return (
    <article
      className={
        attention
          ? 'tool-card ew-surface ew-surface-hover tool-card-attention'
          : 'tool-card ew-surface ew-surface-hover'
      }
      aria-label={ariaLabel}
      data-tour-id={tourId}
    >
      <div className="tool-card-heading ew-compact-row">
        <Icon size={18} />
        <strong>{title}</strong>
        <StatusPill
          label={runtime === 'chrome-built-in' ? 'CHROME' : 'EXTERNAL'}
          tone={isActionDisabled ? 'neutral' : 'success'}
        />
        {preparationStatus === 'downloading' ? null : needsDownload ? (
          <IconButton
            label={`Download ${actionLabel}`}
            attention
            disabled={Boolean(isActionDisabled)}
            onClick={() => {
              void onPrepare?.();
            }}
          >
            <Download size={14} />
          </IconButton>
        ) : canRemove && providerModelId ? (
          <IconButton
            label={`Remove ${actionLabel}`}
            tone="danger"
            onClick={() => {
              void onRemove?.(providerModelId);
            }}
          >
            <X size={14} />
          </IconButton>
        ) : null}
      </div>
      <p>{description}</p>
      <label className="translation-target-control ew-field-scope">
        <span className="translation-target-label ew-inline-row">{selectLabel}</span>
        <select
          aria-label={actionLabel}
          disabled={preparationStatus === 'downloading'}
          value={selectedProviderId}
          onChange={(event) => onProviderChange?.(event.target.value)}
        >
          {providers.map((provider) => (
            <option
              key={provider.id}
              value={provider.id}
              disabled={provider.compatibility === 'incompatible'}
            >
              {provider.label}
              {provider.compatibility === 'incompatible' ? ' - unavailable' : ''}
            </option>
          ))}
        </select>
        {disabledReason ? <span className="translation-source-note">{disabledReason}</span> : null}
      </label>
      {shouldShowPreparation ? (
        <div className="translation-target-control ew-field-scope">
          <div
            className="translation-preparation ew-grid-compact"
            aria-label={preparationAriaLabel}
          >
            <div className="translation-preparation-meta">
              <StatusPill
                label={getPreparationLabel(preparationStatus)}
                tone={getPreparationTone(preparationStatus)}
              />
              <AiToolsDownloadProgress
                details={{ ...preparationDetails, progress: preparationProgress }}
                status={preparationStatus}
              />
            </div>
            {preparationStatus === 'downloading' ? (
              <>
                <div className="model-progress">
                  <span style={{ width: `${preparationProgress}%` }} />
                </div>
                {preparationNote ? (
                  <span className="translation-source-note">{preparationNote}</span>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </article>
  );
}
