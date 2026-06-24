import { Brush, Layers3, Sparkles } from 'lucide-react';
import type { ModelState } from '../../services/interfaces';
import { SegmentedTabs, type SegmentedTab } from '../components/SegmentedTabs';
import { AiToolsPanel } from './AiToolsPanel';
import { DesignPanel } from './DesignPanel';
import { LayersPanel } from './LayersPanel';
import type { RightPanelTab } from './useEditorViewModel';

interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  modelStates: ModelState[];
  onDownloadRequiredModels?: () => Promise<void>;
}

const tabs: Array<SegmentedTab<RightPanelTab>> = [
  { id: 'layout', label: 'Layout', icon: Layers3 },
  { id: 'design', label: 'Design', icon: Brush },
  { id: 'ai-tools', label: 'AI Tools', icon: Sparkles },
];

export function RightPanel({
  activeTab,
  onTabChange,
  modelStates,
  onDownloadRequiredModels,
}: RightPanelProps) {
  return (
    <aside className="right-panel" aria-label="Editor tools">
      <SegmentedTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      <div className="right-panel-body">
        {activeTab === 'ai-tools' ? (
          <AiToolsPanel
            modelStates={modelStates}
            onDownloadRequiredModels={onDownloadRequiredModels}
          />
        ) : null}
        {activeTab === 'layout' ? <LayersPanel /> : null}
        {activeTab === 'design' ? <DesignPanel /> : null}
      </div>
    </aside>
  );
}
