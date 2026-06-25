import { Download, Languages, Palette, ScanSearch } from 'lucide-react';
import type { ModelState } from '../../services/interfaces';
import { IconButton } from '../components/IconButton';
import { PanelSection } from '../components/PanelSection';
import { StatusPill } from '../components/StatusPill';

interface AiToolsPanelProps {
  modelStates: ModelState[];
  onDownloadRequiredModels?: (() => Promise<void>) | undefined;
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

export function AiToolsPanel({ modelStates, onDownloadRequiredModels }: AiToolsPanelProps) {
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
              <article className="tool-card" key={tool.title}>
                <div className="tool-card-heading">
                  <Icon size={18} />
                  <strong>{tool.title}</strong>
                  <StatusPill label="LOCAL" tone="success" />
                </div>
                <p>{tool.description}</p>
              </article>
            );
          })}
        </div>
      </PanelSection>
      <PanelSection title="Cached Browser Models">
        <div className="model-list">
          {modelStates.map((model) => (
            <article className="model-row" key={model.id}>
              <div className="model-row-main">
                <ScanSearch size={17} />
                <div className="model-row-title">
                  <strong>{model.label}</strong>
                  {model.description ? <span>{model.description}</span> : null}
                </div>
                <IconButton label={`Download ${model.label}`}>
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
          ))}
        </div>
      </PanelSection>
    </div>
  );
}
