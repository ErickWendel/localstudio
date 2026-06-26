import { Download, ImagePlus, Languages, ScanSearch, X } from 'lucide-react';
import { GEMMA_LLM_MODEL_ID, TRANSLATEGEMMA_MODEL_ID } from '../../services/aiModelIds';
import { IMAGE_GENERATION_MODEL_ID } from '../../services/imageGenerationModels';
import type { AiProviderState, ModelState } from '../../services/interfaces';
import { IconButton } from '../components/IconButton';
import { StatusPill } from '../components/StatusPill';
import type { CreateImagePromptOptions } from './imagePromptOptions';
import { defaultCreateImagePromptOptions, getImageSizeLabel, imageSizePresets } from './imagePromptOptions';

interface AiToolsPanelProps {
  activeSlideLanguage?: { code: string; displayCode: string; flag: string; label: string } | undefined;
  modelStates: ModelState[];
  attentionModelId?: string | undefined;
  createImageOptions?: CreateImagePromptOptions;
  promptProviderStates?: AiProviderState[] | undefined;
  translationProviderStates?: AiProviderState[] | undefined;
  translationLanguageOptions?: Array<{ code: string; flag: string; label: string }> | undefined;
  translationPreparation?: { progress: number; sourceLanguage?: string; status: 'idle' | 'downloading' | 'ready' | 'failed' } | undefined;
  translationTargetAttention?: boolean | undefined;
  translationTargetLanguage?: string | undefined;
  promptApiAttention?: boolean | undefined;
  promptApiNotice?: string | undefined;
  promptPreparation?: { availability: string; progress: number; status: 'idle' | 'downloading' | 'ready' | 'failed' } | undefined;
  onDownloadModel?: ((id: string) => Promise<void>) | undefined;
  onRemoveModel?: ((id: string) => Promise<void>) | undefined;
  onCreateImageOptionsChange?: ((options: CreateImagePromptOptions) => void) | undefined;
  onPreparePromptApi?: (() => Promise<void>) | undefined;
  onPrepareTranslationProvider?: (() => Promise<void>) | undefined;
  onPromptProviderChange?: ((providerId: string) => void) | undefined;
  onTranslationTargetLanguageChange?: ((languageCode: string) => void) | undefined;
  onTranslationProviderChange?: ((providerId: string) => void) | undefined;
}

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

function getPreparationStatus(
  provider: AiProviderState | undefined,
  preparationStatus: 'idle' | 'downloading' | 'ready' | 'failed',
) {
  if (preparationStatus === 'downloading' || preparationStatus === 'failed') return preparationStatus;
  if (provider?.readiness === 'ready') return 'ready';
  return 'idle';
}

function getPreparationLabel(status: 'idle' | 'downloading' | 'ready' | 'failed') {
  if (status === 'downloading') return 'Downloading';
  if (status === 'ready') return 'Ready';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

function getProgressText(status: 'idle' | 'downloading' | 'ready' | 'failed', progress: number) {
  if (status === 'ready') return undefined;
  if (status === 'downloading' && progress >= 98) return 'Finalizing...';
  return `${progress}%`;
}

function getPreparationTone(status: 'idle' | 'downloading' | 'ready' | 'failed') {
  if (status === 'ready') return 'success';
  if (status === 'downloading') return 'warning';
  return 'neutral';
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

export function AiToolsPanel({
  activeSlideLanguage,
  modelStates,
  attentionModelId,
  createImageOptions = defaultCreateImagePromptOptions,
  promptProviderStates = [],
  translationProviderStates = [],
  translationLanguageOptions = [],
  translationPreparation = { progress: 0, status: 'idle' },
  translationTargetAttention = false,
  translationTargetLanguage = '',
  promptApiAttention = false,
  promptApiNotice,
  promptPreparation = { availability: 'unavailable', progress: 0, status: 'idle' },
  onDownloadModel,
  onRemoveModel,
  onCreateImageOptionsChange,
  onPreparePromptApi,
  onPrepareTranslationProvider,
  onPromptProviderChange,
  onTranslationTargetLanguageChange,
  onTranslationProviderChange,
}: AiToolsPanelProps) {
  function updateCreateImageOptions(patch: Partial<CreateImagePromptOptions>) {
    onCreateImageOptionsChange?.({
      ...createImageOptions,
      ...patch,
    });
  }

  const promptProviders =
    promptProviderStates.length > 0
      ? promptProviderStates
      : [
          {
            id: 'chrome-prompt-api',
            label: 'Chrome Built-in Prompt API',
            description: 'Prompt to slides using Chrome Built-in AI.',
            capability: 'prompt' as const,
            runtime: 'chrome-built-in' as const,
            compatibility: 'compatible' as const,
            readiness: promptPreparation.status === 'ready' ? 'ready' as const : 'needs-download' as const,
            selected: true,
          },
        ];
  const translationProviders =
    translationProviderStates.length > 0
      ? translationProviderStates
      : [
          {
            id: 'chrome-translator-api',
            label: 'Chrome Built-in Translator',
            description: 'Translate visible text using Chrome Built-in AI.',
            capability: 'translation' as const,
            runtime: 'chrome-built-in' as const,
            compatibility: 'compatible' as const,
            readiness: translationPreparation.status === 'ready' ? 'ready' as const : 'needs-download' as const,
            selected: true,
          },
        ];
  const selectedPromptProvider = promptProviders.find((provider) => provider.selected) ?? promptProviders[0];
  const selectedTranslationProvider = translationProviders.find((provider) => provider.selected) ?? translationProviders[0];
  const promptStatus = getPreparationStatus(selectedPromptProvider, promptPreparation.status);
  const promptProgress = promptStatus === 'ready' ? 100 : promptPreparation.progress;
  const promptProgressText = getProgressText(promptStatus, promptProgress);
  const translationProviderStatus = getPreparationStatus(selectedTranslationProvider, translationPreparation.status);
  const translationProviderProgress = translationProviderStatus === 'ready' ? 100 : translationPreparation.progress;
  const translationProviderProgressText = getProgressText(translationProviderStatus, translationProviderProgress);
  const displayedSourceLanguage = activeSlideLanguage?.code ?? translationPreparation.sourceLanguage;
  const selectedPromptNeedsDownload =
    selectedPromptProvider?.readiness === 'needs-download' || selectedPromptProvider?.readiness === 'failed';
  const selectedTranslationNeedsDownload =
    selectedTranslationProvider?.readiness === 'needs-download' || selectedTranslationProvider?.readiness === 'failed';
  const selectedPromptCanRemove = selectedPromptProvider?.modelId && selectedPromptProvider.readiness === 'ready';
  const selectedTranslationCanRemove =
    selectedTranslationProvider?.modelId && selectedTranslationProvider.readiness === 'ready';
  const visibleModelStates = modelStates.filter(
    (model) => model.id !== GEMMA_LLM_MODEL_ID && model.id !== TRANSLATEGEMMA_MODEL_ID,
  );

  return (
    <div className="panel-stack">
      <div className="tool-card-list">
          <article
            className={promptApiAttention ? 'tool-card tool-card-attention' : 'tool-card'}
            aria-label="LLM Model"
          >
            <div className="tool-card-heading">
              <ImagePlus size={18} />
              <strong>LLM Model</strong>
              <StatusPill
                label={selectedPromptProvider?.runtime === 'chrome-built-in' ? 'CHROME' : 'EXTERNAL'}
                tone={selectedPromptProvider?.compatibility === 'compatible' ? 'success' : 'neutral'}
              />
              {promptStatus === 'downloading' ? null : selectedPromptNeedsDownload ? (
                <IconButton
                  label="Download LLM Model"
                  attention
                  disabled={selectedPromptProvider?.compatibility === 'incompatible'}
                  onClick={() => {
                    void onPreparePromptApi?.();
                  }}
                >
                  <Download size={14} />
                </IconButton>
              ) : selectedPromptCanRemove ? (
                <IconButton
                  label="Remove LLM Model"
                  tone="danger"
                  onClick={() => {
                    void onRemoveModel?.(selectedPromptProvider.modelId!);
                  }}
                >
                  <X size={14} />
                </IconButton>
              ) : null}
            </div>
            <p>Choose the local model used for prompt-to-slides.</p>
            <label className="translation-target-control">
              <span className="translation-target-label">Model</span>
              <select
                aria-label="LLM Model"
                disabled={promptPreparation.status === 'downloading'}
                value={selectedPromptProvider?.id ?? ''}
                onChange={(event) => onPromptProviderChange?.(event.target.value)}
              >
                {promptProviders.map((provider) => (
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
              {selectedPromptProvider?.disabledReason ? (
                <span className="translation-source-note">{selectedPromptProvider.disabledReason}</span>
              ) : null}
            </label>
            <div className="translation-target-control">
              <div className="translation-preparation" aria-label="LLM preparation">
                <div className="translation-preparation-meta">
                  <StatusPill
                    label={getPreparationLabel(promptStatus)}
                    tone={getPreparationTone(promptStatus)}
                  />
                  {promptProgressText ? <span>{promptProgressText}</span> : null}
                </div>
                {promptStatus === 'ready' ? null : (
                  <>
                    <div className="model-progress">
                      <span style={{ width: `${promptProgress}%` }} />
                    </div>
                    <span className="translation-source-note">
                      {promptApiNotice ?? `Availability: ${promptPreparation.availability}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          </article>

          <article
            className={translationTargetAttention ? 'tool-card tool-card-attention' : 'tool-card'}
            aria-label="Translate Design"
          >
            <div className="tool-card-heading">
              <Languages size={18} />
              <strong>Translate Design</strong>
              <StatusPill
                label={selectedTranslationProvider?.runtime === 'chrome-built-in' ? 'CHROME' : 'EXTERNAL'}
                tone={selectedTranslationProvider?.compatibility === 'compatible' ? 'success' : 'neutral'}
              />
              {translationProviderStatus === 'downloading' ? null : selectedTranslationNeedsDownload ? (
                <IconButton
                  label="Download Translation Model"
                  attention
                  disabled={selectedTranslationProvider?.compatibility === 'incompatible'}
                  onClick={() => {
                    void onPrepareTranslationProvider?.();
                  }}
                >
                  <Download size={14} />
                </IconButton>
              ) : selectedTranslationCanRemove ? (
                <IconButton
                  label="Remove Translation Model"
                  tone="danger"
                  onClick={() => {
                    void onRemoveModel?.(selectedTranslationProvider.modelId!);
                  }}
                >
                  <X size={14} />
                </IconButton>
              ) : null}
            </div>
            <p>Translate visible text using the selected local translation model.</p>
            <label className="translation-target-control">
              <span className="translation-target-label">Translation Model</span>
              <select
                aria-label="Translation Model"
                disabled={translationPreparation.status === 'downloading'}
                value={selectedTranslationProvider?.id ?? ''}
                onChange={(event) => onTranslationProviderChange?.(event.target.value)}
              >
                {translationProviders.map((provider) => (
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
              {selectedTranslationProvider?.disabledReason ? (
                <span className="translation-source-note">{selectedTranslationProvider.disabledReason}</span>
              ) : null}
            </label>
            <label className="translation-target-control">
              <span className="translation-target-label">
                Translate to:
                <ToolHelp
                  id="translation-target-tooltip"
                  text="Choose the language that will be used for all translations in this deck."
                />
              </span>
              <select
                aria-label="Translate to"
                aria-describedby="translation-target-tooltip"
                disabled={translationPreparation.status === 'downloading'}
                value={translationTargetLanguage}
                onChange={(event) => {
                  onTranslationTargetLanguageChange?.(event.target.value);
                }}
              >
                <option value="">Choose language</option>
                {translationLanguageOptions.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label} ({language.code}) {language.flag}
                  </option>
                ))}
              </select>
              {translationTargetLanguage ? (
                <div className="translation-preparation" aria-label="Translation language preparation">
                  <div className="translation-preparation-meta">
                    <StatusPill
                      label={getPreparationLabel(translationProviderStatus)}
                      tone={getPreparationTone(translationProviderStatus)}
                    />
                  {translationProviderProgressText ? <span>{translationProviderProgressText}</span> : null}
                  </div>
                  {translationProviderStatus === 'ready' ? null : (
                    <div className="model-progress">
                      <span style={{ width: `${translationProviderProgress}%` }} />
                    </div>
                  )}
                  {displayedSourceLanguage ? (
                    <span className="translation-source-note">
                      Pair: {displayedSourceLanguage} → {translationTargetLanguage}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </label>
          </article>

          {visibleModelStates.map((model) => {
            const needsAttention = attentionModelId === model.id && model.status !== 'ready';
            return (
              <article
                aria-label={model.label}
                className={needsAttention ? 'model-row model-row-attention' : 'model-row'}
                key={model.id}
              >
                <div className="model-row-main">
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
                      attention={needsAttention || model.status === 'needs-download' || model.status === 'failed'}
                      disabled={model.status === 'downloading'}
                      onClick={() => {
                        void onDownloadModel?.(model.id);
                      }}
                    >
                      <Download size={14} />
                    </IconButton>
                  )}
                </div>
                <div className="model-row-meta">
                  <StatusPill label={formatStatus(model.status)} tone={statusTone(model.status)} />
                  {model.status === 'ready' ? null : <span>{model.progress}%</span>}
                </div>
                {model.status === 'ready' ? null : (
                  <div className="model-progress" aria-label={`${model.label} progress`}>
                    <span style={{ width: `${model.progress}%` }} />
                  </div>
                )}
                {model.id === IMAGE_GENERATION_MODEL_ID ? (
                  <div className="image-generation-settings" aria-label="Image generation settings">
                    <div className="image-generation-setting">
                      <span className="translation-target-label">Size</span>
                      <div className="image-size-presets" role="group" aria-label="Image size">
                        {imageSizePresets.map((preset) => (
                          <button
                            key={preset.label}
                            aria-pressed={getImageSizeLabel(createImageOptions) === preset.label}
                            className="image-size-preset"
                            type="button"
                            onClick={() => {
                              updateCreateImageOptions({ width: preset.width, height: preset.height });
                            }}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="image-generation-setting image-generation-range">
                      <span className="translation-target-label">
                        Steps
                        <ToolHelp
                          id="image-steps-tooltip"
                          text="Steps control how many generation passes the model runs. Lower is faster; higher can add detail but takes longer. Use 4 for quick drafts."
                        />
                      </span>
                      <input
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
                      <span className="translation-target-label">
                        Seed
                        <ToolHelp
                          id="image-seed-tooltip"
                          text="Seed controls randomness. Leave it random for new variations, or reuse the same number to recreate a similar image from the same prompt and options."
                        />
                      </span>
                      <input
                        aria-label="Image seed"
                        className="image-generation-seed-input"
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
          })}
      </div>
    </div>
  );
}
