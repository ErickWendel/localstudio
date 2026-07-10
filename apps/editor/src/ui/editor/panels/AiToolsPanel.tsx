import { Download, ImagePlus, Languages, ScanSearch, X } from 'lucide-react';
import { aiModelCatalog } from '../../../services/model-setup/aiModelCatalog';
import type {
  AiProviderState,
  ModelDownloadProgressDetails,
  ModelState,
} from '../../../services/contracts/interfaces';
import { IconButton } from '../../components/IconButton';
import { StatusPill } from '../../components/StatusPill';
import { AiToolsDownloadProgress } from './AiToolsDownloadProgress';
import { AiToolsModelRow } from './AiToolsModelRow';
import { aiToolsProviderFallbacks } from './AiToolsProviderFallbacks';
import { AiToolsSetupAction } from './AiToolsSetupAction';
import type { CreateImagePromptOptions } from '../media/imagePromptOptions';
import { imagePromptOptions } from '../media/imagePromptOptions';

interface AiToolsPanelProps {
  activeSlideLanguage?:
    | { code: string; displayCode: string; flag: string; label: string }
    | undefined;
  modelStates: ModelState[];
  attentionModelId?: string | undefined;
  createImageOptions?: CreateImagePromptOptions;
  promptProviderStates?: AiProviderState[] | undefined;
  translationProviderStates?: AiProviderState[] | undefined;
  languageDetectionProviderStates?: AiProviderState[] | undefined;
  translationLanguageOptions?: Array<{ code: string; flag: string; label: string }> | undefined;
  languageDetectionPreparation?:
    | (ModelDownloadProgressDetails & {
        progress: number;
        sourceLanguage?: string;
        status: 'idle' | 'downloading' | 'ready' | 'failed';
      })
    | undefined;
  translationPreparation?:
    | (ModelDownloadProgressDetails & {
        progress: number;
        sourceLanguage?: string;
        status: 'idle' | 'downloading' | 'ready' | 'failed';
      })
    | undefined;
  translationTargetAttention?: boolean | undefined;
  translationTargetLanguage?: string | undefined;
  promptApiAttention?: boolean | undefined;
  promptApiNotice?: string | undefined;
  promptPreparation?:
    | (ModelDownloadProgressDetails & {
        availability: string;
        progress: number;
        status: 'idle' | 'downloading' | 'ready' | 'failed';
      })
    | undefined;
  onDownloadModel?: ((id: string) => Promise<void>) | undefined;
  onRemoveModel?: ((id: string) => Promise<void>) | undefined;
  onCreateImageOptionsChange?: ((options: CreateImagePromptOptions) => void) | undefined;
  onPreparePromptApi?: (() => Promise<void>) | undefined;
  onPrepareLanguageDetectionProvider?: (() => Promise<void>) | undefined;
  onPrepareTranslationProvider?: (() => Promise<void>) | undefined;
  onPromptProviderChange?: ((providerId: string) => void) | undefined;
  onLanguageDetectionProviderChange?: ((providerId: string) => void) | undefined;
  onTranslationTargetLanguageChange?: ((languageCode: string) => void) | undefined;
  onTranslationProviderChange?: ((providerId: string) => void) | undefined;
}

function getPreparationStatus(
  provider: AiProviderState | undefined,
  preparationStatus: 'idle' | 'downloading' | 'ready' | 'failed',
): 'idle' | 'downloading' | 'ready' | 'failed' {
  if (preparationStatus === 'downloading' || preparationStatus === 'failed')
    return preparationStatus;
  if (provider?.readiness === 'ready') return 'ready';
  return 'idle';
}

function getPreparationLabel(status: 'idle' | 'downloading' | 'ready' | 'failed') {
  if (status === 'downloading') return 'Downloading';
  if (status === 'ready') return 'Ready';
  if (status === 'failed') return 'Failed';
  return 'Pending';
}

function getPreparationTone(status: 'idle' | 'downloading' | 'ready' | 'failed') {
  if (status === 'ready') return 'success';
  if (status === 'downloading') return 'warning';
  return 'neutral';
}

function getModelProgressStatus(
  status: ModelState['status'],
): 'idle' | 'downloading' | 'ready' | 'failed' {
  if (status === 'downloading') return 'downloading';
  if (status === 'ready') return 'ready';
  if (status === 'failed') return 'failed';
  return 'idle';
}

function getModelSetupTaskStatus(
  modelStates: ModelState[],
  modelId: string,
): 'idle' | 'downloading' | 'ready' | 'failed' {
  return getModelProgressStatus(
    modelStates.find((model) => model.id === modelId)?.status ?? 'needs-download',
  );
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
  createImageOptions = imagePromptOptions.defaultCreateImagePromptOptions,
  promptProviderStates = [],
  translationProviderStates = [],
  languageDetectionProviderStates = [],
  translationLanguageOptions = [],
  languageDetectionPreparation = { progress: 0, status: 'idle' },
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
  onPrepareLanguageDetectionProvider,
  onPrepareTranslationProvider,
  onPromptProviderChange,
  onLanguageDetectionProviderChange,
  onTranslationTargetLanguageChange,
  onTranslationProviderChange,
}: AiToolsPanelProps) {
  const promptProviders =
    promptProviderStates.length > 0
      ? promptProviderStates
      : [aiToolsProviderFallbacks.prompt(promptPreparation.status === 'ready')];
  const translationProviders =
    translationProviderStates.length > 0
      ? translationProviderStates
      : [aiToolsProviderFallbacks.translation(translationPreparation.status === 'ready')];
  const languageDetectionProviders =
    languageDetectionProviderStates.length > 0
      ? languageDetectionProviderStates
      : [aiToolsProviderFallbacks.languageDetection()];
  const selectedPromptProvider =
    promptProviders.find((provider) => provider.selected) ?? promptProviders[0];
  const selectedTranslationProvider =
    translationProviders.find((provider) => provider.selected) ?? translationProviders[0];
  const selectedLanguageDetectionProvider =
    languageDetectionProviders.find((provider) => provider.selected) ??
    languageDetectionProviders[0];
  const promptStatus = getPreparationStatus(selectedPromptProvider, promptPreparation.status);
  const promptProgress = promptStatus === 'ready' ? 100 : promptPreparation.progress;
  const languageDetectionStatus = getPreparationStatus(
    selectedLanguageDetectionProvider,
    languageDetectionPreparation.status,
  );
  const languageDetectionProgress =
    languageDetectionStatus === 'ready' ? 100 : languageDetectionPreparation.progress;
  const translationProviderStatus = getPreparationStatus(
    selectedTranslationProvider,
    translationPreparation.status,
  );
  const translationProviderProgress =
    translationProviderStatus === 'ready' ? 100 : translationPreparation.progress;
  const displayedSourceLanguage =
    activeSlideLanguage?.code ?? translationPreparation.sourceLanguage;
  const selectedPromptNeedsDownload =
    selectedPromptProvider?.readiness === 'needs-download' ||
    selectedPromptProvider?.readiness === 'failed';
  const selectedTranslationNeedsDownload =
    selectedTranslationProvider?.readiness === 'needs-download' ||
    selectedTranslationProvider?.readiness === 'failed';
  const selectedLanguageDetectionNeedsDownload =
    selectedLanguageDetectionProvider?.readiness === 'needs-download' ||
    selectedLanguageDetectionProvider?.readiness === 'failed';
  const selectedPromptCanRemove =
    selectedPromptProvider?.modelId && selectedPromptProvider.readiness === 'ready';
  const selectedLanguageDetectionCanRemove =
    selectedLanguageDetectionProvider?.modelId &&
    selectedLanguageDetectionProvider.readiness === 'ready';
  const selectedTranslationCanRemove =
    selectedTranslationProvider?.modelId && selectedTranslationProvider.readiness === 'ready';
  const shouldShowTranslationLanguageProgress = !selectedTranslationProvider?.modelId;
  const visibleModelStates = modelStates.filter(
    (model) =>
      model.id !== aiModelCatalog.GEMMA_LLM_MODEL_ID &&
      model.id !== aiModelCatalog.TRANSLATEGEMMA_MODEL_ID &&
      model.id !== aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID,
  );
  const hiddenModelSetupTasks = [
    {
      id: aiModelCatalog.GEMMA_LLM_MODEL_ID,
      label: aiModelCatalog.GEMMA_LLM_DISPLAY_NAME,
      onPrepare: onDownloadModel
        ? () => onDownloadModel(aiModelCatalog.GEMMA_LLM_MODEL_ID)
        : undefined,
      status: getModelSetupTaskStatus(modelStates, aiModelCatalog.GEMMA_LLM_MODEL_ID),
    },
    {
      id: aiModelCatalog.TRANSLATEGEMMA_MODEL_ID,
      label: aiModelCatalog.TRANSLATEGEMMA_DISPLAY_NAME,
      onPrepare: onDownloadModel
        ? () => onDownloadModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID)
        : undefined,
      status: getModelSetupTaskStatus(modelStates, aiModelCatalog.TRANSLATEGEMMA_MODEL_ID),
    },
  ];
  const setupTasks = [
    ...(selectedPromptProvider?.modelId === aiModelCatalog.GEMMA_LLM_MODEL_ID
      ? []
      : [
          {
            disabled: selectedPromptProvider?.compatibility === 'incompatible',
            id: selectedPromptProvider?.id ?? 'prompt-provider',
            label: selectedPromptProvider?.label ?? 'LLM model',
            onPrepare: onPreparePromptApi,
            status: promptStatus,
          },
        ]),
    {
      disabled: selectedLanguageDetectionProvider?.compatibility === 'incompatible',
      id: selectedLanguageDetectionProvider?.id ?? 'language-detection-provider',
      label: selectedLanguageDetectionProvider?.label ?? 'Language detection model',
      onPrepare: onPrepareLanguageDetectionProvider,
      status: languageDetectionStatus,
    },
    ...(selectedTranslationProvider?.modelId === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID
      ? []
      : [
          {
            disabled: selectedTranslationProvider?.compatibility === 'incompatible',
            id: selectedTranslationProvider?.id ?? 'translation-provider',
            label: selectedTranslationProvider?.label ?? 'Translation model',
            onPrepare: onPrepareTranslationProvider,
            status: translationProviderStatus,
          },
        ]),
    ...hiddenModelSetupTasks,
    ...visibleModelStates.map((model) => ({
      id: model.id,
      label: model.label,
      onPrepare: onDownloadModel ? () => onDownloadModel(model.id) : undefined,
      status: getModelProgressStatus(model.status),
    })),
  ];

  return (
    <div className="panel-stack" data-tour-id="ai-tools-panel">
      <AiToolsSetupAction tasks={setupTasks} />
      <div className="tool-card-list ew-panel-card">
        <article
          className={
            promptApiAttention
              ? 'tool-card ew-surface ew-surface-hover tool-card-attention'
              : 'tool-card ew-surface ew-surface-hover'
          }
          aria-label="LLM Model"
          data-tour-id="ai-llm-model"
        >
          <div className="tool-card-heading ew-compact-row">
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
          <label className="translation-target-control ew-field-scope">
            <span className="translation-target-label ew-inline-row">Model</span>
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
              <span className="translation-source-note">
                {selectedPromptProvider.disabledReason}
              </span>
            ) : null}
          </label>
          <div className="translation-target-control ew-field-scope">
            <div className="translation-preparation ew-grid-compact" aria-label="LLM preparation">
              <div className="translation-preparation-meta">
                <StatusPill
                  label={getPreparationLabel(promptStatus)}
                  tone={getPreparationTone(promptStatus)}
                />
                <AiToolsDownloadProgress
                  details={{ ...promptPreparation, progress: promptProgress }}
                  status={promptStatus}
                />
              </div>
              {promptStatus === 'downloading' ? (
                <>
                  <div className="model-progress">
                    <span style={{ width: `${promptProgress}%` }} />
                  </div>
                  <span className="translation-source-note">
                    {promptApiNotice ?? `Availability: ${promptPreparation.availability}`}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </article>

        <article
          className="tool-card ew-surface ew-surface-hover"
          aria-label="Language Detection"
          data-tour-id="ai-language-detection"
        >
          <div className="tool-card-heading ew-compact-row">
            <ScanSearch size={18} />
            <strong>Language Detection</strong>
            <StatusPill
              label={
                selectedLanguageDetectionProvider?.runtime === 'chrome-built-in'
                  ? 'CHROME'
                  : 'EXTERNAL'
              }
              tone={
                selectedLanguageDetectionProvider?.compatibility === 'compatible'
                  ? 'success'
                  : 'neutral'
              }
            />
            {languageDetectionStatus ===
            'downloading' ? null : selectedLanguageDetectionNeedsDownload ? (
              <IconButton
                label="Download Language Detection Model"
                attention
                disabled={selectedLanguageDetectionProvider?.compatibility === 'incompatible'}
                onClick={() => {
                  void onPrepareLanguageDetectionProvider?.();
                }}
              >
                <Download size={14} />
              </IconButton>
            ) : selectedLanguageDetectionCanRemove ? (
              <IconButton
                label="Remove Language Detection Model"
                tone="danger"
                onClick={() => {
                  void onRemoveModel?.(selectedLanguageDetectionProvider.modelId!);
                }}
              >
                <X size={14} />
              </IconButton>
            ) : null}
          </div>
          <p>Choose how LocalStudio.dev detects source text language before translation.</p>
          <label className="translation-target-control ew-field-scope">
            <span className="translation-target-label ew-inline-row">Detection Model</span>
            <select
              aria-label="Language Detection Model"
              disabled={languageDetectionPreparation.status === 'downloading'}
              value={selectedLanguageDetectionProvider?.id ?? ''}
              onChange={(event) => onLanguageDetectionProviderChange?.(event.target.value)}
            >
              {languageDetectionProviders.map((provider) => (
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
            {selectedLanguageDetectionProvider?.disabledReason ? (
              <span className="translation-source-note">
                {selectedLanguageDetectionProvider.disabledReason}
              </span>
            ) : null}
          </label>
          <div className="translation-target-control ew-field-scope">
            <div
              className="translation-preparation ew-grid-compact"
              aria-label="Language detection preparation"
            >
              <div className="translation-preparation-meta">
                <StatusPill
                  label={getPreparationLabel(languageDetectionStatus)}
                  tone={getPreparationTone(languageDetectionStatus)}
                />
                <AiToolsDownloadProgress
                  details={{ ...languageDetectionPreparation, progress: languageDetectionProgress }}
                  status={languageDetectionStatus}
                />
              </div>
              {languageDetectionStatus === 'downloading' ? (
                <div className="model-progress">
                  <span style={{ width: `${languageDetectionProgress}%` }} />
                </div>
              ) : null}
            </div>
          </div>
        </article>

        <article
          className={
            translationTargetAttention
              ? 'tool-card ew-surface ew-surface-hover tool-card-attention'
              : 'tool-card ew-surface ew-surface-hover'
          }
          aria-label="Translate Design"
          data-tour-id="ai-translate-design"
        >
          <div className="tool-card-heading ew-compact-row">
            <Languages size={18} />
            <strong>Translate Design</strong>
            <StatusPill
              label={
                selectedTranslationProvider?.runtime === 'chrome-built-in' ? 'CHROME' : 'EXTERNAL'
              }
              tone={
                selectedTranslationProvider?.compatibility === 'compatible' ? 'success' : 'neutral'
              }
            />
            {translationProviderStatus ===
            'downloading' ? null : selectedTranslationNeedsDownload ? (
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
          <label className="translation-target-control ew-field-scope">
            <span className="translation-target-label ew-inline-row">Translation Model</span>
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
              <span className="translation-source-note">
                {selectedTranslationProvider.disabledReason}
              </span>
            ) : null}
          </label>
          {selectedTranslationProvider?.modelId ? (
            <div className="translation-target-control ew-field-scope">
              <div
                className="translation-preparation ew-grid-compact"
                aria-label="Translation model preparation"
              >
                <div className="translation-preparation-meta">
                  <StatusPill
                    label={getPreparationLabel(translationProviderStatus)}
                    tone={getPreparationTone(translationProviderStatus)}
                  />
                  <AiToolsDownloadProgress
                    details={{ ...translationPreparation, progress: translationProviderProgress }}
                    status={translationProviderStatus}
                  />
                </div>
                {translationProviderStatus === 'downloading' ? (
                  <div className="model-progress">
                    <span style={{ width: `${translationProviderProgress}%` }} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          <label className="translation-target-control ew-field-scope">
            <span className="translation-target-label ew-inline-row">
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
              <div
                className="translation-preparation ew-grid-compact"
                aria-label="Translation language preparation"
              >
                {shouldShowTranslationLanguageProgress ? (
                  <>
                    <div className="translation-preparation-meta">
                      <StatusPill
                        label={getPreparationLabel(translationProviderStatus)}
                        tone={getPreparationTone(translationProviderStatus)}
                      />
                      <AiToolsDownloadProgress
                        details={{
                          ...translationPreparation,
                          progress: translationProviderProgress,
                        }}
                        status={translationProviderStatus}
                      />
                    </div>
                    {translationProviderStatus === 'downloading' ? (
                      <div className="model-progress">
                        <span style={{ width: `${translationProviderProgress}%` }} />
                      </div>
                    ) : null}
                  </>
                ) : null}
                {displayedSourceLanguage ? (
                  <span className="translation-source-note">
                    Pair: {displayedSourceLanguage} → {translationTargetLanguage}
                  </span>
                ) : null}
              </div>
            ) : null}
          </label>
        </article>

        {visibleModelStates.map((model) => (
          <AiToolsModelRow
            createImageOptions={createImageOptions}
            key={model.id}
            model={model}
            needsAttention={attentionModelId === model.id && model.status !== 'ready'}
            onCreateImageOptionsChange={onCreateImageOptionsChange}
            onDownloadModel={onDownloadModel}
            onRemoveModel={onRemoveModel}
          />
        ))}
      </div>
    </div>
  );
}
