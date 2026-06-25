import { Brush, Layers3, Sparkles } from 'lucide-react';
import type { PageBackground, ProjectDocument, SelectionState } from '../../domain/model';
import type { ElementStylePatch } from '../../domain/commands/basicCommands';
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
  attentionModelId?: string | undefined;
  translationLanguageOptions?: Array<{ code: string; flag: string; label: string }>;
  translationPreparation?: { progress: number; sourceLanguage?: string; status: 'idle' | 'downloading' | 'ready' | 'failed' };
  translationTargetAttention?: boolean;
  translationTargetLanguage?: string;
  promptApiAttention?: boolean;
  promptApiNotice?: string | undefined;
  promptPreparation?: { availability: string; progress: number; status: 'idle' | 'downloading' | 'ready' | 'failed' };
  onDownloadModel?: (id: string) => Promise<void>;
  onPreparePromptApi?: () => Promise<void>;
  onTranslationTargetLanguageChange?: (languageCode: string) => void;
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onSelectElement?: (elementId: string, options?: { additive?: boolean }) => void;
  onSetElementVisibility?: (elementId: string, visible: boolean) => void;
  onSetElementLock?: (elementId: string, locked: boolean) => void;
  onDeleteElement?: (elementId: string) => void;
  onReorderElement?: (elementId: string, targetElementId: string) => void;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
  onUpdatePageBackground?: (background: PageBackground) => void;
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
  attentionModelId,
  translationLanguageOptions,
  translationPreparation,
  translationTargetAttention,
  translationTargetLanguage,
  promptApiAttention,
  promptApiNotice,
  promptPreparation,
  onDownloadModel,
  onPreparePromptApi,
  onTranslationTargetLanguageChange,
  project,
  activePageId,
  selection,
  onSelectElement,
  onSetElementVisibility,
  onSetElementLock,
  onDeleteElement,
  onReorderElement,
  onUpdateElementStyle,
  onUpdatePageBackground,
}: RightPanelProps) {
  return (
    <aside className="right-panel" aria-label="Editor tools">
      <SegmentedTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      <div className="right-panel-body">
        {activeTab === 'ai-tools' ? (
          <AiToolsPanel
            modelStates={modelStates}
            attentionModelId={attentionModelId}
            translationLanguageOptions={translationLanguageOptions}
            translationPreparation={translationPreparation}
            translationTargetAttention={translationTargetAttention}
            translationTargetLanguage={translationTargetLanguage}
            promptApiAttention={promptApiAttention}
            promptApiNotice={promptApiNotice}
            promptPreparation={promptPreparation}
            onDownloadModel={onDownloadModel}
            onPreparePromptApi={onPreparePromptApi}
            onTranslationTargetLanguageChange={onTranslationTargetLanguageChange}
          />
        ) : null}
        {activeTab === 'layout' ? (
          <LayersPanel
            project={project}
            activePageId={activePageId}
            selection={selection}
            {...(onSelectElement ? { onSelectElement } : {})}
            {...(onSetElementVisibility ? { onSetElementVisibility } : {})}
            {...(onSetElementLock ? { onSetElementLock } : {})}
            {...(onDeleteElement ? { onDeleteElement } : {})}
            {...(onReorderElement ? { onReorderElement } : {})}
          />
        ) : null}
        {activeTab === 'design' ? (
          <DesignPanel
            project={project}
            activePageId={activePageId}
            selection={selection}
            {...(onUpdateElementStyle ? { onUpdateElementStyle } : {})}
            {...(onUpdatePageBackground ? { onUpdatePageBackground } : {})}
          />
        ) : null}
      </div>
    </aside>
  );
}
