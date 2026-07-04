import type { TextPreset } from '../state/useEditorViewModel';

interface TextPanelProps {
  onInsertText?: (preset: TextPreset) => void;
}

const textPresets: Array<{
  label: string;
  preset: TextPreset;
  sampleClassName: string;
}> = [
  { label: 'Add a heading', preset: 'title', sampleClassName: 'text-preset-sample-title' },
  { label: 'Add a subheading', preset: 'subtitle', sampleClassName: 'text-preset-sample-subtitle' },
  { label: 'Add a little bit of body text', preset: 'body', sampleClassName: 'text-preset-sample-body' },
];

export function TextPanel({ onInsertText }: TextPanelProps) {
  return (
    <section className="panel-stack" aria-label="Text tools">
      <label className="layer-search text-search ew-surface ew-compact-row">
        <span className="material-symbols-outlined" aria-hidden="true">
          search
        </span>
        <input type="search" placeholder="Search fonts and combinations" aria-label="Search fonts and combinations" />
      </label>

      <button className="text-primary-action" type="button" onClick={() => onInsertText?.('body')}>
        <span className="material-symbols-outlined" aria-hidden="true">
          title
        </span>
        Add a text box
      </button>

      <div className="text-brand-kit">
        <span className="material-symbols-outlined" aria-hidden="true">
          business_center
        </span>
        <span>Brand Kit</span>
        <span className="material-symbols-outlined" aria-hidden="true">
          expand_more
        </span>
      </div>

      <div className="text-brand-preview" aria-label="Brand text styles">
        <button type="button" onClick={() => onInsertText?.('title')}>
          <span className="font-orbitron">Title</span>
        </button>
        <button type="button" onClick={() => onInsertText?.('subtitle')}>
          <span>Subtitle</span>
        </button>
      </div>

      <div className="panel-section">
        <h2 className="panel-heading text-panel-heading">Default text styles</h2>
        <div className="text-preset-list">
          {textPresets.map((item) => (
            <button
              className="text-preset-button"
              key={item.preset}
              type="button"
              onClick={() => onInsertText?.(item.preset)}
            >
              <span className={item.sampleClassName}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
