import { Brush, Layers3, Sparkles } from 'lucide-react';
import type { PageBackground, ProjectDocument, SelectionState } from '../../../domain/documents/model';
import type {
  AlignMode,
  ElementFramePatch,
  ElementStylePatch,
  MediaPlaybackPatch,
  ZOrderMode,
} from '../../../domain/commands/elements/basicCommands';
import type { AiProviderState, ModelState } from '../../../services/contracts/interfaces';
import { SegmentedTabs, type SegmentedTab } from '../../components/SegmentedTabs';
import { AiToolsPanel } from './AiToolsPanel';
import { DesignPanel } from './DesignPanel';
import type { CreateImagePromptOptions } from '../media/imagePromptOptions';
import { LayersPanel } from './LayersPanel';
import type { RightPanelTab } from '../state/useEditorViewModel';

type LegacyRightPanelTab = Exclude<RightPanelTab, 'assets' | 'animations' | 'elements' | 'text'>;

interface RightPanelProps {
  activeTab: LegacyRightPanelTab;
  onTabChange: (tab: LegacyRightPanelTab) => void;
  modelStates: ModelState[];
  attentionModelId?: string | undefined;
  createImageOptions?: CreateImagePromptOptions;
  promptProviderStates?: AiProviderState[];
  translationProviderStates?: AiProviderState[];
  translationLanguageOptions?: Array<{ code: string; flag: string; label: string }>;
  translationPreparation?: { progress: number; sourceLanguage?: string; status: 'idle' | 'downloading' | 'ready' | 'failed' };
  translationTargetAttention?: boolean;
  translationTargetLanguage?: string;
  promptApiAttention?: boolean;
  promptApiNotice?: string | undefined;
  promptPreparation?: { availability: string; progress: number; status: 'idle' | 'downloading' | 'ready' | 'failed' };
  onDownloadModel?: (id: string) => Promise<void>;
  onRemoveModel?: (id: string) => Promise<void>;
  onCreateImageOptionsChange?: (options: CreateImagePromptOptions) => void;
  onPreparePromptApi?: () => Promise<void>;
  onPrepareTranslationProvider?: () => Promise<void>;
  onPromptProviderChange?: (providerId: string) => void;
  onTranslationTargetLanguageChange?: (languageCode: string) => void;
  onTranslationProviderChange?: (providerId: string) => void;
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onSelectElement?: (elementId: string, options?: { additive?: boolean }) => void;
  onSetElementVisibility?: (elementId: string, visible: boolean) => void;
  onSetElementLock?: (elementId: string, locked: boolean) => void;
  onDeleteElement?: (elementId: string) => void;
  onReorderElement?: (elementId: string, targetElementId: string, position?: 'before' | 'after') => void;
  onAlignSelectedElement?: (mode: AlignMode) => void;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
  onUpdateElementFrame?: (elementId: string, patch: ElementFramePatch) => void;
  onUpdateMediaPlayback?: (elementId: string, patch: MediaPlaybackPatch) => void;
  onUpdatePageBackground?: (background: PageBackground) => void;
  onSetSelectedElementZOrder?: (mode: ZOrderMode) => void;
  onReplaceVideoAsset?: (elementId: string, file: File) => void;
}

const tabs: Array<SegmentedTab<LegacyRightPanelTab>> = [
  { id: 'layout', label: 'Layout', icon: Layers3 },
  { id: 'design', label: 'Design', icon: Brush },
  { id: 'ai-tools', label: 'AI Tools', icon: Sparkles },
];

export function RightPanel({
  activeTab,
  onTabChange,
  modelStates,
  attentionModelId,
  createImageOptions,
  promptProviderStates,
  translationProviderStates,
  translationLanguageOptions,
  translationPreparation,
  translationTargetAttention,
  translationTargetLanguage,
  promptApiAttention,
  promptApiNotice,
  promptPreparation,
  onDownloadModel,
  onRemoveModel,
  onCreateImageOptionsChange,
  onPreparePromptApi,
  onPrepareTranslationProvider,
  onPromptProviderChange,
  onTranslationTargetLanguageChange,
  onTranslationProviderChange,
  project,
  activePageId,
  selection,
  onSelectElement,
  onSetElementVisibility,
  onSetElementLock,
  onDeleteElement,
  onReorderElement,
  onAlignSelectedElement,
  onUpdateElementStyle,
  onUpdateElementFrame,
  onUpdateMediaPlayback,
  onUpdatePageBackground,
  onSetSelectedElementZOrder,
  onReplaceVideoAsset,
}: RightPanelProps) {
  return (
    <aside className="right-panel" aria-label="Editor tools">
      <SegmentedTabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      <div className="right-panel-body">
        {activeTab === 'ai-tools' ? (
          <AiToolsPanel
            modelStates={modelStates}
            attentionModelId={attentionModelId}
            promptProviderStates={promptProviderStates}
            translationProviderStates={translationProviderStates}
            translationLanguageOptions={translationLanguageOptions}
            translationPreparation={translationPreparation}
            translationTargetAttention={translationTargetAttention}
            translationTargetLanguage={translationTargetLanguage}
            promptApiAttention={promptApiAttention}
            promptApiNotice={promptApiNotice}
            promptPreparation={promptPreparation}
            onDownloadModel={onDownloadModel}
            onRemoveModel={onRemoveModel}
            onCreateImageOptionsChange={onCreateImageOptionsChange}
            onPreparePromptApi={onPreparePromptApi}
            onPrepareTranslationProvider={onPrepareTranslationProvider}
            onPromptProviderChange={onPromptProviderChange}
            onTranslationTargetLanguageChange={onTranslationTargetLanguageChange}
            onTranslationProviderChange={onTranslationProviderChange}
            {...(createImageOptions ? { createImageOptions } : {})}
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
            {...(onAlignSelectedElement ? { onAlignSelectedElement } : {})}
            {...(onSetElementLock ? { onSetElementLock } : {})}
            {...(onSetSelectedElementZOrder ? { onSetSelectedElementZOrder } : {})}
            {...(onUpdateElementFrame ? { onUpdateElementFrame } : {})}
            {...(onUpdateElementStyle ? { onUpdateElementStyle } : {})}
            {...(onUpdateMediaPlayback ? { onUpdateMediaPlayback } : {})}
            {...(onUpdatePageBackground ? { onUpdatePageBackground } : {})}
            {...(onReplaceVideoAsset ? { onReplaceVideoAsset } : {})}
          />
        ) : null}
      </div>
    </aside>
  );
}
