import { Download, Languages, Palette, ScanSearch } from 'lucide-react';
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
  onDownloadRequiredModels?: (() => Promise<void>) | undefined;
  onDownloadModel?: ((id: string) => Promise<void>) | undefined;
  onTranslationTargetLanguageChange?: ((languageCode: string) => void) | undefined;
}

const localTools = [
  {
    title: 'Translate Design',
    description: 'Translate visible text using the detected startup language.',
    icon: Languages,
  },
  {
    title: 'Text-to-Palette',
    description: 'Generate precise color schemes from text prompts.',
    icon: Palette,
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
  onDownloadRequiredModels,
  onDownloadModel,
  onTranslationTargetLanguageChange,
}: AiToolsPanelProps) {
  return (
    <div className="panel-stack">
      <button
        className="download-models-button"
        type="button"
        onClick={() => {
          void onDownloadRequiredModels?.();
        }}
      >
        Download Required Models
      </button>
      <PanelSection title="Local Chrome AI">
        <div className="tool-card-list">
          {localTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <article
                className={
                  tool.title === 'Translate Design' && translationTargetAttention
                    ? 'tool-card tool-card-attention'
                    : 'tool-card'
                }
                key={tool.title}
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
