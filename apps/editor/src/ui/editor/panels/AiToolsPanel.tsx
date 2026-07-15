import { ImagePlus, Languages, ScanSearch } from 'lucide-react';
import { aiModelCatalog } from '../../../services/model-setup/aiModelCatalog';
import type {
  AiProviderState,
  ModelDownloadProgressDetails,
  ModelState,
} from '../../../services/contracts/interfaces';
import { StatusPill } from '../../components/StatusPill';
import { AiToolsDownloadProgress } from './AiToolsDownloadProgress';
import { AiToolsHelpTip } from './AiToolsHelpTip';
import { AiToolsModelRow } from './AiToolsModelRow';
import { aiToolsProviderFallbacks } from './AiToolsProviderFallbacks';
import { AiToolsProviderCard } from './AiToolsProviderCard';
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
  const setupTasks = [
    {
      disabled: selectedPromptProvider?.compatibility === 'incompatible',
      id: selectedPromptProvider?.id ?? 'prompt-provider',
      label: selectedPromptProvider?.label ?? 'LLM model',
      onPrepare: onPreparePromptApi,
      progress: promptProgress,
      status: promptStatus,
    },
    {
      disabled: selectedLanguageDetectionProvider?.compatibility === 'incompatible',
      id: selectedLanguageDetectionProvider?.id ?? 'language-detection-provider',
      label: selectedLanguageDetectionProvider?.label ?? 'Language detection model',
      onPrepare: onPrepareLanguageDetectionProvider,
      progress: languageDetectionProgress,
      status: languageDetectionStatus,
    },
    {
      disabled: selectedTranslationProvider?.compatibility === 'incompatible',
      id: selectedTranslationProvider?.id ?? 'translation-provider',
      label: selectedTranslationProvider?.label ?? 'Translation model',
      onPrepare: onPrepareTranslationProvider,
      progress: translationProviderProgress,
      status: translationProviderStatus,
    },
    ...visibleModelStates.map((model) => ({
      id: model.id,
      label: model.label,
      onPrepare: onDownloadModel ? () => onDownloadModel(model.id) : undefined,
      progress: model.status === 'ready' ? 100 : model.progress,
      status: getModelProgressStatus(model.status),
    })),
  ];

  return (
    <div className="panel-stack" data-tour-id="ai-tools-panel">
      <AiToolsSetupAction tasks={setupTasks} />
      <div className="tool-card-list ew-panel-card">
        <AiToolsProviderCard
          actionLabel="LLM Model"
          ariaLabel="LLM Model"
          attention={promptApiAttention}
          canRemove={Boolean(selectedPromptCanRemove)}
          description="Choose the local model used for prompt-to-slides."
          disabledReason={selectedPromptProvider?.disabledReason}
          icon={ImagePlus}
          isActionDisabled={selectedPromptProvider?.compatibility === 'incompatible'}
          needsDownload={selectedPromptNeedsDownload}
          onPrepare={onPreparePromptApi}
          onProviderChange={onPromptProviderChange}
          onRemove={onRemoveModel}
          preparationAriaLabel="LLM preparation"
          preparationDetails={promptPreparation}
          preparationNote={promptApiNotice ?? `Availability: ${promptPreparation.availability}`}
          preparationProgress={promptProgress}
          preparationStatus={promptStatus}
          providerModelId={selectedPromptProvider?.modelId}
          providers={promptProviders}
          runtime={selectedPromptProvider?.runtime}
          selectedProviderId={selectedPromptProvider?.id ?? ''}
          selectLabel="Model"
          title="LLM Model"
          tourId="ai-llm-model"
        />

        <AiToolsProviderCard
          actionLabel="Language Detection Model"
          ariaLabel="Language Detection"
          canRemove={Boolean(selectedLanguageDetectionCanRemove)}
          description="Choose how LocalStudio.dev detects source text language before translation."
          disabledReason={selectedLanguageDetectionProvider?.disabledReason}
          icon={ScanSearch}
          isActionDisabled={selectedLanguageDetectionProvider?.compatibility === 'incompatible'}
          needsDownload={selectedLanguageDetectionNeedsDownload}
          onPrepare={onPrepareLanguageDetectionProvider}
          onProviderChange={onLanguageDetectionProviderChange}
          onRemove={onRemoveModel}
          preparationAriaLabel="Language detection preparation"
          preparationDetails={languageDetectionPreparation}
          preparationProgress={languageDetectionProgress}
          preparationStatus={languageDetectionStatus}
          providerModelId={selectedLanguageDetectionProvider?.modelId}
          providers={languageDetectionProviders}
          runtime={selectedLanguageDetectionProvider?.runtime}
          selectedProviderId={selectedLanguageDetectionProvider?.id ?? ''}
          selectLabel="Detection Model"
          title="Language Detection"
          tourId="ai-language-detection"
        />

        <AiToolsProviderCard
          actionLabel="Translation Model"
          ariaLabel="Translate Design"
          attention={translationTargetAttention}
          canRemove={Boolean(selectedTranslationCanRemove)}
          description="Translate visible text using the selected local translation model."
          disabledReason={selectedTranslationProvider?.disabledReason}
          icon={Languages}
          isActionDisabled={selectedTranslationProvider?.compatibility === 'incompatible'}
          needsDownload={selectedTranslationNeedsDownload}
          onPrepare={onPrepareTranslationProvider}
          onProviderChange={onTranslationProviderChange}
          onRemove={onRemoveModel}
          preparationAriaLabel="Translation model preparation"
          preparationDetails={translationPreparation}
          preparationProgress={translationProviderProgress}
          preparationStatus={translationProviderStatus}
          providerModelId={selectedTranslationProvider?.modelId}
          providers={translationProviders}
          runtime={selectedTranslationProvider?.runtime}
          selectedProviderId={selectedTranslationProvider?.id ?? ''}
          selectLabel="Translation Model"
          shouldShowPreparation={Boolean(selectedTranslationProvider?.modelId)}
          title="Translate Design"
          tourId="ai-translate-design"
        >
          <label className="translation-target-control ew-field-scope">
            <span className="translation-target-label ew-inline-row">
              Translate to:
              <AiToolsHelpTip
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
        </AiToolsProviderCard>

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
