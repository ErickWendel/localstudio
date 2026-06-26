import { Brush, ImagePlus, Layers3, Sparkles, Type } from 'lucide-react';
import { useRef } from 'react';
import type { PageBackground, ProjectDocument, SelectionState } from '../../domain/model';
import type { ElementStylePatch } from '../../domain/commands/basicCommands';
import type { AiProviderState, ModelState } from '../../services/interfaces';
import { AiToolsPanel } from './AiToolsPanel';
import { DesignPanel } from './DesignPanel';
import type { CreateImagePromptOptions } from './imagePromptOptions';
import { LayersPanel } from './LayersPanel';
import { TextPanel } from './TextPanel';
import type { RightPanelTab, TextPreset } from './useEditorViewModel';

interface LeftToolPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelTab) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  onImportImage?: (file: File) => void;
  onInsertText?: (preset: TextPreset) => void;
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
  onReorderElement?: (elementId: string, targetElementId: string) => void;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
  onUpdatePageBackground?: (background: PageBackground) => void;
}

const menuItems: Array<{ id: RightPanelTab; label: string; icon: typeof Layers3 }> = [
  { id: 'layout', label: 'Layout', icon: Layers3 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'design', label: 'Design', icon: Brush },
  { id: 'ai-tools', label: 'AI Tools', icon: Sparkles },
  { id: 'assets', label: 'Assets', icon: ImagePlus },
];

export function LeftToolPanel({
  activeTab,
  onTabChange,
  open = false,
  onOpenChange,
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
  onImportImage,
  onInsertText,
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
  onUpdateElementStyle,
  onUpdatePageBackground,
}: LeftToolPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAttentionOpen = Boolean(attentionModelId || promptApiAttention || translationTargetAttention);
  const panelOpen = open || isAttentionOpen;

  return (
    <aside className={panelOpen ? 'left-tool-panel left-tool-panel-open' : 'left-tool-panel'} aria-label="Editor tools">
      <nav className="left-tool-rail" aria-label="Tool menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = panelOpen && item.id === activeTab;
          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              aria-expanded={isActive}
              aria-selected={isActive}
              className={isActive ? 'left-tool-button left-tool-button-active' : 'left-tool-button'}
              key={item.id}
              role="tab"
              type="button"
              onClick={() => {
                if (item.id === activeTab && panelOpen && !isAttentionOpen) {
                  onOpenChange?.(false);
                  return;
                }
                onTabChange(item.id);
                onOpenChange?.(true);
              }}
            >
              <Icon size={19} strokeWidth={2.2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="left-tool-content">
        {panelOpen && activeTab === 'layout' ? (
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
        {panelOpen && activeTab === 'design' ? (
          <DesignPanel
            project={project}
            activePageId={activePageId}
            selection={selection}
            {...(onUpdateElementStyle ? { onUpdateElementStyle } : {})}
            {...(onUpdatePageBackground ? { onUpdatePageBackground } : {})}
          />
        ) : null}
        {panelOpen && activeTab === 'text' ? (
          <TextPanel {...(onInsertText ? { onInsertText } : {})} />
        ) : null}
        {panelOpen && activeTab === 'ai-tools' ? (
          <AiToolsPanel
            modelStates={modelStates}
            attentionModelId={attentionModelId}
            translationLanguageOptions={translationLanguageOptions}
            promptProviderStates={promptProviderStates}
            translationProviderStates={translationProviderStates}
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
        {panelOpen && activeTab === 'assets' ? (
          <section className="panel-stack">
            <div className="panel-section">
              <h2 className="panel-heading">Assets</h2>
              <p className="panel-muted">Import images from disk into the active page.</p>
            </div>
            <button
              className="compact-action compact-action-full"
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                add_photo_alternate
              </span>
              Import Image
            </button>
            <input
              ref={fileInputRef}
              aria-label="Import image file"
              className="visually-hidden-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                onImportImage?.(file);
                event.target.value = '';
              }}
            />
          </section>
        ) : null}
      </div>
    </aside>
  );
}
