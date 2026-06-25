import { Download, ImagePlus, Languages, ScanSearch } from 'lucide-react';
import type { ModelState } from '../../services/interfaces';
import { IconButton } from '../components/IconButton';
import { PanelSection } from '../components/PanelSection';
import { StatusPill } from '../components/StatusPill';

interface AiToolsPanelProps {
  modelStates: ModelState[];
  attentionModelId?: string | undefined;
  translationLanguageOptions?: Array<{ code: string; flag: string; label: string }> | undefined;
  translationPreparation?: { progress: number; sourceLanguage?: string; status: 'idle' | 'downloading' | 'ready' | 'failed' } | undefined;
  translationTargetAttention?: boolean | undefined;
  translationTargetLanguage?: string | undefined;
  promptApiAttention?: boolean | undefined;
  promptApiNotice?: string | undefined;
  promptPreparation?: { availability: string; progress: number; status: 'idle' | 'downloading' | 'ready' | 'failed' } | undefined;
  onDownloadModel?: ((id: string) => Promise<void>) | undefined;
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

export function AiToolsPanel({
  modelStates,
  attentionModelId,
  translationLanguageOptions = [],
  translationPreparation = { progress: 0, status: 'idle' },
  translationTargetAttention = false,
  translationTargetLanguage = '',
  promptApiAttention = false,
  promptApiNotice,
  promptPreparation = { availability: 'unavailable', progress: 0, status: 'idle' },
  onDownloadModel,
  onPreparePromptApi,
  onTranslationTargetLanguageChange,
}: AiToolsPanelProps) {
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
                      <span className="translation-target-help">
                        <span
                          aria-describedby="translation-target-tooltip"
                          className="material-symbols-outlined"
                          tabIndex={0}
                        >
                          info
                        </span>
                        <span id="translation-target-tooltip" className="translation-target-tooltip" role="tooltip">
                          Choose the language that will be used for all translations in this deck.
                        </span>
                      </span>
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
              </article>
            );
          })}
        </div>
      </PanelSection>
    </div>
  );
}
