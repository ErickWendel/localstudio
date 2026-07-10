import { Download, ScanSearch, X } from 'lucide-react';
import { imageGenerationModel } from '../../../services/image-generation/imageGenerationModel';
import type { ModelState } from '../../../services/contracts/interfaces';
import { modelSetupService } from '../../../services/model-setup/modelSetupService';
import { IconButton } from '../../components/IconButton';
import { StatusPill } from '../../components/StatusPill';
import type { CreateImagePromptOptions } from '../media/imagePromptOptions';
import { imagePromptOptions } from '../media/imagePromptOptions';
import { AiToolsDownloadProgress } from './AiToolsDownloadProgress';

function statusTone(status: ModelState['status']) {
  if (status === 'ready') return 'success';
  if (status === 'downloading') return 'warning';
  return 'neutral';
}

function formatStatus(status: ModelState['status']) {
  return status
    .split('-')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

function getModelProgressStatus(
  status: ModelState['status'],
): 'idle' | 'downloading' | 'ready' | 'failed' {
  if (status === 'downloading') return 'downloading';
  if (status === 'ready') return 'ready';
  if (status === 'failed') return 'failed';
  return 'idle';
}

function getFixedModelDisplayName(modelId: string, fallback: string) {
  if (modelId === modelSetupService.IMAGE_EDITING_MODEL_ID)
    return modelSetupService.IMAGE_EDITING_DISPLAY_NAME;
  if (modelId === imageGenerationModel.IMAGE_GENERATION_MODEL_ID)
    return imageGenerationModel.IMAGE_GENERATION_DISPLAY_NAME;
  return fallback;
}

function ToolHelp({ id, text }: { id: string; text: string }) {
  return (
    <span className="translation-target-help">
      <span aria-describedby={id} className="material-symbols-outlined" tabIndex={0}>
        info
      </span>
      <span id={id} className="translation-target-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

export function AiToolsModelRow({
  createImageOptions,
  model,
  needsAttention,
  onCreateImageOptionsChange,
  onDownloadModel,
  onRemoveModel,
}: {
  createImageOptions: CreateImagePromptOptions;
  model: ModelState;
  needsAttention: boolean;
  onCreateImageOptionsChange?: ((options: CreateImagePromptOptions) => void) | undefined;
  onDownloadModel?: ((id: string) => Promise<void>) | undefined;
  onRemoveModel?: ((id: string) => Promise<void>) | undefined;
}) {
  function updateCreateImageOptions(patch: Partial<CreateImagePromptOptions>) {
    onCreateImageOptionsChange?.({
      ...createImageOptions,
      ...patch,
    });
  }

  return (
    <article
      aria-label={model.label}
      className={
        needsAttention
          ? 'model-row ew-surface ew-surface-hover model-row-attention'
          : 'model-row ew-surface ew-surface-hover'
      }
      data-tour-id={
        model.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID
          ? 'ai-image-generation-model'
          : undefined
      }
    >
      <div className="model-row-main ew-compact-row">
        <ScanSearch size={17} />
        <div className="model-row-title">
          <strong>{model.label}</strong>
          {model.description ? <span>{model.description}</span> : null}
        </div>
        {model.status === 'ready' ? (
          <IconButton
            label={`Remove ${model.label}`}
            tone="danger"
            onClick={() => {
              void onRemoveModel?.(model.id);
            }}
          >
            <X size={14} />
          </IconButton>
        ) : (
          <IconButton
            label={`Download ${model.label}`}
            attention={
              needsAttention || model.status === 'needs-download' || model.status === 'failed'
            }
            disabled={model.status === 'downloading'}
            onClick={() => {
              void onDownloadModel?.(model.id);
            }}
          >
            <Download size={14} />
          </IconButton>
        )}
      </div>
      <label className="translation-target-control ew-field-scope model-row-selector">
        <span className="translation-target-label ew-inline-row">Model</span>
        <select aria-label={`${model.label} model`} value={model.id} onChange={() => undefined}>
          <option value={model.id}>{getFixedModelDisplayName(model.id, model.label)}</option>
        </select>
      </label>
      <div className="model-row-meta ew-compact-row">
        <StatusPill label={formatStatus(model.status)} tone={statusTone(model.status)} />
        <AiToolsDownloadProgress details={model} status={getModelProgressStatus(model.status)} />
      </div>
      {model.status === 'ready' ? null : (
        <div className="model-progress" aria-label={`${model.label} progress`}>
          <span style={{ width: `${model.progress}%` }} />
        </div>
      )}
      {model.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID ? (
        <div className="image-generation-settings" aria-label="Image generation settings">
          <div className="image-generation-setting">
            <span className="translation-target-label ew-inline-row">Size</span>
            <div className="image-size-presets" role="group" aria-label="Image size">
              {imagePromptOptions.imageSizePresets.map((preset) => (
                <button
                  key={preset.label}
                  aria-pressed={
                    imagePromptOptions.getImageSizeLabel(createImageOptions) === preset.label
                  }
                  className="image-size-preset"
                  type="button"
                  onClick={() => {
                    updateCreateImageOptions({
                      width: preset.width,
                      height: preset.height,
                    });
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <label className="image-generation-setting image-generation-range">
            <span className="translation-target-label ew-inline-row">
              Steps
              <ToolHelp
                id="image-steps-tooltip"
                text="Steps control how many generation passes the model runs. Lower is faster; higher can add detail but takes longer. Use 4 for quick drafts."
              />
            </span>
            <input
              className="ew-range-input"
              type="range"
              min={1}
              max={8}
              step={1}
              value={createImageOptions.steps}
              onChange={(event) => {
                updateCreateImageOptions({ steps: Number(event.target.value) });
              }}
            />
            <strong>{createImageOptions.steps}</strong>
          </label>
          <label className="image-generation-setting">
            <span className="translation-target-label ew-inline-row">
              Seed
              <ToolHelp
                id="image-seed-tooltip"
                text="Seed controls randomness. Leave it random for new variations, or reuse the same number to recreate a similar image from the same prompt and options."
              />
            </span>
            <input
              aria-label="Image seed"
              className="image-generation-seed-input ew-field"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="random"
              type="text"
              value={createImageOptions.seed?.toString() ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/\D/g, '').slice(0, 10);
                if (!nextValue) {
                  onCreateImageOptionsChange?.({
                    width: createImageOptions.width,
                    height: createImageOptions.height,
                    steps: createImageOptions.steps,
                  });
                  return;
                }
                updateCreateImageOptions({ seed: Number.parseInt(nextValue, 10) });
              }}
            />
          </label>
        </div>
      ) : null}
      {model.status === 'failed' && model.error ? (
        <span className="translation-source-note">{model.error}</span>
      ) : null}
    </article>
  );
}
