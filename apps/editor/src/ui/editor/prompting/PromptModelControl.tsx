import { ChevronDown, Download, X } from 'lucide-react';
import type {
  ModelDownloadProgressDetails,
  ModelStatus,
} from '../../../services/contracts/interfaces';
import { AiToolsDownloadProgress } from '../panels/AiToolsDownloadProgress';

type PromptPreparationStatus = 'idle' | 'downloading' | 'ready' | 'failed';

export interface PromptModelControlOption {
  compatibility: 'compatible' | 'incompatible' | 'unknown';
  id: string;
  label: string;
  modelId?: string | undefined;
  readiness: ModelStatus;
  selected: boolean;
}

export interface PromptModelControlState {
  label?: string | undefined;
  preparation: ModelDownloadProgressDetails & {
    availability: string;
    progress: number;
    status: PromptPreparationStatus;
  };
  options: PromptModelControlOption[];
}

function getSelectedOption(options: PromptModelControlOption[]) {
  return options.find((option) => option.selected) ?? options[0];
}

function getPreparationStatus(
  option: PromptModelControlOption | undefined,
  preparationStatus: PromptPreparationStatus,
): PromptPreparationStatus {
  if (preparationStatus === 'downloading' || preparationStatus === 'failed') {
    return preparationStatus;
  }
  if (option?.readiness === 'ready') return 'ready';
  return 'idle';
}

function getProgressValue(status: PromptPreparationStatus, progress: number) {
  if (status === 'ready') return 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

export function PromptModelControl({
  compact = false,
  disabled = false,
  state,
  onCancelDownload,
  onPrepare,
  onProviderChange,
}: {
  compact?: boolean;
  disabled?: boolean;
  state: PromptModelControlState;
  onCancelDownload?: ((modelId: string) => Promise<void>) | undefined;
  onPrepare?: (() => Promise<void>) | undefined;
  onProviderChange?: ((providerId: string) => void) | undefined;
}) {
  const selectedOption = getSelectedOption(state.options);
  if (!selectedOption) return null;

  const status = getPreparationStatus(selectedOption, state.preparation.status);
  const progress = getProgressValue(status, state.preparation.progress);
  const isDownloading = status === 'downloading';
  const needsDownload =
    selectedOption.readiness === 'needs-download' || selectedOption.readiness === 'failed';
  const isIncompatible = selectedOption.compatibility === 'incompatible';
  const canUseSelect =
    !disabled && !isDownloading && (state.options.length === 1 || Boolean(onProviderChange));
  const canCancelDownload =
    Boolean(onCancelDownload) && !disabled && isDownloading && Boolean(selectedOption.modelId);
  const canPrepare = Boolean(onPrepare) && !disabled && !isDownloading && !isIncompatible;

  return (
    <div
      className={compact ? 'prompt-model-control prompt-model-control-compact' : 'prompt-model-control'}
      aria-label={state.label ?? 'Prompt model'}
    >
      <label className="prompt-model-select-shell">
        <span className="visually-hidden-input">{state.label ?? 'Prompt model'}</span>
        <select
          aria-label={state.label ?? 'Prompt model'}
          disabled={!canUseSelect}
          value={selectedOption.id}
          onChange={(event) => onProviderChange?.(event.target.value)}
        >
          {state.options.map((option) => (
            <option
              disabled={option.compatibility === 'incompatible'}
              key={option.id}
              value={option.id}
            >
              {option.label}
              {option.compatibility === 'incompatible' ? ' - unavailable' : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
      {needsDownload || isDownloading ? (
        <button
          aria-label={
            isDownloading
              ? `Downloading ${selectedOption.label}`
              : `Download ${selectedOption.label}`
          }
          className="prompt-model-download-button"
          disabled={!canPrepare}
          title={
            isDownloading
              ? `Downloading ${selectedOption.label}`
              : `Download ${selectedOption.label}`
          }
          type="button"
          onClick={() => {
            void onPrepare?.();
          }}
        >
          <Download size={14} aria-hidden="true" />
        </button>
      ) : null}
      {isDownloading ? (
        <div className="prompt-model-progress" aria-label="Prompt model download progress">
          {selectedOption.modelId ? (
            <button
              aria-label={`Cancel ${selectedOption.label} download`}
              className="prompt-model-cancel-button"
              disabled={!canCancelDownload}
              title={`Cancel ${selectedOption.label} download`}
              type="button"
              onClick={() => {
                if (!selectedOption.modelId) return;
                void onCancelDownload?.(selectedOption.modelId);
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
          <div
            aria-label={`${selectedOption.label} download progress`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            className="model-progress"
            role="progressbar"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <AiToolsDownloadProgress
            details={{ ...state.preparation, progress }}
            status="downloading"
          />
        </div>
      ) : null}
    </div>
  );
}
