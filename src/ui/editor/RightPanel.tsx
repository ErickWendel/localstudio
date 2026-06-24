import { Brush, Layers3, Sparkles } from 'lucide-react';
import type { ModelState } from '../../services/interfaces';
import type { RightPanelTab } from './useEditorViewModel';

interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  modelStates: ModelState[];
}

const tabs: Array<{ id: RightPanelTab; label: string; icon: typeof Sparkles }> = [
  { id: 'ai-tools', label: 'AI Tools', icon: Sparkles },
  { id: 'design', label: 'Design', icon: Brush },
  { id: 'layers', label: 'Layers', icon: Layers3 },
];

export function RightPanel({ activeTab, onTabChange, modelStates }: RightPanelProps) {
  return (
    <aside className="right-panel" aria-label="Editor tools">
      <div className="right-panel-tabs" role="tablist" aria-label="Tool panels">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? 'panel-tab panel-tab-active' : 'panel-tab'}
              type="button"
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="right-panel-body">
        {activeTab === 'ai-tools' ? (
          <section>
            <h2 className="panel-heading font-orbitron">AI Tools</h2>
            <button className="download-models-button" type="button">
              Download Required Models
            </button>
            <p className="panel-muted">{modelStates.length} models tracked locally</p>
          </section>
        ) : null}
        {activeTab === 'design' ? (
          <section>
            <h2 className="panel-heading font-orbitron">Design</h2>
            <p className="panel-muted">16:9 Presentation</p>
          </section>
        ) : null}
        {activeTab === 'layers' ? (
          <section>
            <h2 className="panel-heading font-orbitron">Layers</h2>
            <p className="panel-muted">5 layers on current page</p>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
