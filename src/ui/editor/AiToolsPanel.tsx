import { Download, ImagePlus, Languages, ScanSearch } from 'lucide-react';
import { IMAGE_GENERATION_MODEL_ID } from '../../services/imageGenerationModels';
import type { ModelState } from '../../services/interfaces';
import { IconButton } from '../components/IconButton';
import { PanelSection } from '../components/PanelSection';
import { StatusPill } from '../components/StatusPill';
import type { CreateImagePromptOptions } from './imagePromptOptions';
import { defaultCreateImagePromptOptions, getImageSizeLabel, imageSizePresets } from './imagePromptOptions';

interface AiToolsPanelProps {
  modelStates: ModelState[];
  attentionModelId?: string | undefined;
  createImageOptions?: CreateImagePromptOptions;
  translationLanguageOptions?: Array<{ code: string; flag: string; label: string }> | undefined;
  translationPreparation?: { progress: number; sourceLanguage?: string; status: 'idle' | 'downloading' | 'ready' | 'failed' } | undefined;
  translationTargetAttention?: boolean | undefined;
  translationTargetLanguage?: string | undefined;
  promptApiAttention?: boolean | undefined;
  promptApiNotice?: string | undefined;
  promptPreparation?: { availability: string; progress: number; status: 'idle' | 'downloading' | 'ready' | 'failed' } | undefined;
  onDownloadModel?: ((id: string) => Promise<void>) | undefined;
  onCreateImageOptionsChange?: ((options: CreateImagePromptOptions) => void) | undefined;
  onPreparePromptApi?: (() => Promise<void>) | undefined;
  onTranslationTargetLanguageChange?: ((languageCode: string) => void) | undefined;
}

const localTools = [
  {
    title: 'Prompt API',
    description: 'Prompt to slides using Chrome Built-in AI.',
    icon: ImagePlus,
  },
  {
    title: 'Translate Design',
    description: 'Translate visible text using the detected startup language.',
    icon: Languages,
  },
];

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
  modelStates,
  attentionModelId,
  createImageOptions = defaultCreateImagePromptOptions,
  translationLanguageOptions = [],
  translationPreparation = { progress: 0, status: 'idle' },
  translationTargetAttention = false,
  translationTargetLanguage = '',
  promptApiAttention = false,
  promptApiNotice,
  promptPreparation = { availability: 'unavailable', progress: 0, status: 'idle' },
  onDownloadModel,
  onCreateImageOptionsChange,
  onPreparePromptApi,
  onTranslationTargetLanguageChange,
}: AiToolsPanelProps) {
  function updateCreateImageOptions(patch: Partial<CreateImagePromptOptions>) {
    onCreateImageOptionsChange?.({
      ...createImageOptions,
      ...patch,
    });
  }

  return (
    <div className="panel-stack">
      <PanelSection title="Local Chrome AI">
        <div className="tool-card-list">
          {localTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <article
                className={
                  (tool.title === 'Translate Design' && translationTargetAttention) ||
                  (tool.title === 'Prompt API' && promptApiAttention)
                    ? 'tool-card tool-card-attention'
                    : 'tool-card'
                }
                key={tool.title}
                aria-label={tool.title}
              >
                <div className="tool-card-heading">
                  <Icon size={18} />
                  <strong>{tool.title}</strong>
                  <StatusPill label="LOCAL" tone="success" />
                </div>
                <p>{tool.description}</p>
                {tool.title === 'Translate Design' ? (
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
                            label={
                              translationPreparation.status === 'downloading'
                                ? 'Downloading'
                                : translationPreparation.status === 'ready'
                                  ? 'Ready'
                                  : translationPreparation.status === 'failed'
                                    ? 'Failed'
                                    : 'Pending'
                            }
                            tone={
                              translationPreparation.status === 'ready'
                                ? 'success'
                                : translationPreparation.status === 'downloading'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          />
                          <span>{translationPreparation.progress}%</span>
                        </div>
                        <div className="model-progress">
                          <span style={{ width: `${translationPreparation.progress}%` }} />
                        </div>
                        {translationPreparation.sourceLanguage ? (
                          <span className="translation-source-note">
                            Pair: {translationPreparation.sourceLanguage} → {translationTargetLanguage}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </label>
                ) : null}
                {tool.title === 'Prompt API' ? (
                  <div className="translation-target-control">
                    {promptPreparation.status === 'ready' ? null : (
                      <button
                        className="compact-action compact-action-full"
                        disabled={promptPreparation.status === 'downloading'}
                        type="button"
                        onClick={() => {
                          void onPreparePromptApi?.();
                        }}
                      >
                        <Download size={14} />
                        <span>Prepare Prompt API</span>
                      </button>
                    )}
                    <div className="translation-preparation" aria-label="Prompt API preparation">
                      <div className="translation-preparation-meta">
                        <StatusPill
                          label={
                            promptPreparation.status === 'downloading'
                              ? 'Downloading'
                              : promptPreparation.status === 'ready'
                                ? 'Ready'
                                : promptPreparation.status === 'failed'
                                  ? 'Failed'
                                  : 'Pending'
                          }
                          tone={
                            promptPreparation.status === 'ready'
                              ? 'success'
                              : promptPreparation.status === 'downloading'
                                ? 'warning'
                                : 'neutral'
                          }
                        />
                        <span>{promptPreparation.progress}%</span>
                      </div>
                      <div className="model-progress">
                        <span style={{ width: `${promptPreparation.progress}%` }} />
                      </div>
                      <span className="translation-source-note">
                        {promptPreparation.status === 'ready'
                          ? ''
                          : promptApiNotice ?? `Availability: ${promptPreparation.availability}`}
                      </span>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </PanelSection>
      <PanelSection title="Cached Browser Models">
        <div className="model-list">
          {modelStates.map((model) => {
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
                  <IconButton
                    label={`Download ${model.label}`}
                    attention={needsAttention}
                    disabled={model.status === 'ready' || model.status === 'downloading'}
                    onClick={() => {
                      void onDownloadModel?.(model.id);
                    }}
                  >
                    <Download size={14} />
                  </IconButton>
                </div>
                <div className="model-row-meta">
                  <StatusPill label={formatStatus(model.status)} tone={statusTone(model.status)} />
                  <span>{model.progress}%</span>
                </div>
                <div className="model-progress" aria-label={`${model.label} progress`}>
                  <span style={{ width: `${model.progress}%` }} />
                </div>
                {model.status === 'failed' && model.error ? (
                  <span className="translation-source-note">{model.error}</span>
                ) : null}
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
              </article>
            );
          })}
        </div>
      </PanelSection>
    </div>
  );
}
