import { Brush, Clapperboard, ImagePlus, Layers3, Shapes, Sparkles, Type } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { collectReferencedAssetIds } from '../../../domain/assets/assetUsage';
import type {
  Asset,
  ElementAnimationBuild,
  PageBackground,
  ProjectDocument,
  SelectionState,
  ShapeKind,
  SlideTransition,
} from '../../../domain/documents/model';
import type {
  AlignMode,
  ElementFramePatch,
  ElementStylePatch,
  MediaPlaybackPatch,
  ZOrderMode,
} from '../../../domain/commands/elements/basicCommands';
import type {
  AiProviderState,
  FontCatalogItem,
  ModelState,
  StockMediaItem,
  StockMediaProviderState,
} from '../../../services/contracts/interfaces';
import { AiToolsPanel } from './AiToolsPanel';
import { AnimationPanel } from './AnimationPanel';
import { DesignPanel } from './DesignPanel';
import { ElementsPanel } from './ElementsPanel';
import type { CreateImagePromptOptions } from '../media/imagePromptOptions';
import { localMediaImportConfig } from '../media/localMediaImportConfig';
import { LayersPanel } from './LayersPanel';
import { TextPanel } from './TextPanel';
import type { RightPanelTab, TextPreset } from '../state/useEditorViewModel';
import type { StockMediaErrorState } from '../state/use-stock-media-library';

interface LeftToolPanelProps {
  activeTab: RightPanelTab;
  animationPreview?:
    | {
        activeBuildElementId: string | undefined;
        mode?: 'editor' | 'presenter';
        pageId: string;
        phase: 'transition' | 'animation' | 'waiting' | 'complete';
        playing: boolean;
        waitingForClick: boolean;
      }
    | undefined;
  activeSlideLanguage?:
    | { code: string; displayCode: string; flag: string; label: string }
    | undefined;
  focusFontControlKey?: number | undefined;
  onTabChange: (tab: RightPanelTab) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  modelStates: ModelState[];
  attentionModelId?: string | undefined;
  createImageOptions?: CreateImagePromptOptions;
  promptProviderStates?: AiProviderState[];
  translationProviderStates?: AiProviderState[];
  languageDetectionProviderStates?: AiProviderState[];
  translationLanguageOptions?: Array<{ code: string; flag: string; label: string }>;
  availableFonts?: FontCatalogItem[];
  languageDetectionPreparation?: {
    progress: number;
    sourceLanguage?: string;
    status: 'idle' | 'downloading' | 'ready' | 'failed';
  };
  translationPreparation?: {
    progress: number;
    sourceLanguage?: string;
    status: 'idle' | 'downloading' | 'ready' | 'failed';
  };
  translationTargetAttention?: boolean;
  translationTargetLanguage?: string;
  promptApiAttention?: boolean;
  promptApiNotice?: string | undefined;
  promptPreparation?: {
    availability: string;
    progress: number;
    status: 'idle' | 'downloading' | 'ready' | 'failed';
  };
  onDownloadModel?: ((id: string) => Promise<void>) | undefined;
  onDownloadFont?: ((family: string) => Promise<void>) | undefined;
  onRemoveModel?: ((id: string) => Promise<void>) | undefined;
  onCreateImageOptionsChange?: ((options: CreateImagePromptOptions) => void) | undefined;
  stockGifResults?: StockMediaItem[];
  stockImageResults?: StockMediaItem[];
  stockMediaError?: StockMediaErrorState | undefined;
  stockMediaProviderState?: StockMediaProviderState;
  stockMediaRecentItems?: StockMediaItem[];
  stockMediaSearchingGifs?: boolean;
  stockMediaSearchingImages?: boolean;
  onConfigureStockMedia?: (() => void) | undefined;
  onImportImage?: ((file: File) => void) | undefined;
  onRemoveAsset?: ((assetId: string) => void) | undefined;
  onImportMedia?: ((file: File) => void) | undefined;
  onInsertStockMedia?: ((item: StockMediaItem) => void) | undefined;
  onInsertText?: ((preset: TextPreset) => void) | undefined;
  onInsertShape?: ((shape: ShapeKind) => void) | undefined;
  onSearchStockGifs?: ((query: string) => void) | undefined;
  onSearchStockImages?: ((query: string) => void) | undefined;
  onPreparePromptApi?: (() => Promise<void>) | undefined;
  onPrepareLanguageDetectionProvider?: (() => Promise<void>) | undefined;
  onPrepareTranslationProvider?: (() => Promise<void>) | undefined;
  onPromptProviderChange?: ((providerId: string) => void) | undefined;
  onLanguageDetectionProviderChange?: ((providerId: string) => void) | undefined;
  onTranslationTargetLanguageChange?: ((languageCode: string) => void) | undefined;
  onTranslationProviderChange?: ((providerId: string) => void) | undefined;
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onSelectElement?: ((elementId: string, options?: { additive?: boolean }) => void) | undefined;
  onSetElementVisibility?: ((elementId: string, visible: boolean) => void) | undefined;
  onSetElementLock?: ((elementId: string, locked: boolean) => void) | undefined;
  onDeleteElement?: ((elementId: string) => void) | undefined;
  onReorderElement?:
    | ((elementId: string, targetElementId: string, position?: 'before' | 'after') => void)
    | undefined;
  onAlignSelectedElement?: ((mode: AlignMode) => void) | undefined;
  onSetSelectedElementZOrder?: ((mode: ZOrderMode) => void) | undefined;
  onUpdateElementFrame?: ((elementId: string, patch: ElementFramePatch) => void) | undefined;
  onUpdateElementStyle?: ((elementId: string, patch: ElementStylePatch) => void) | undefined;
  onUpdateTextContent?: ((elementId: string, text: string) => void) | undefined;
  onUpdateMediaPlayback?: ((elementId: string, patch: MediaPlaybackPatch) => void) | undefined;
  onUpdatePageBackground?: ((background: PageBackground) => void) | undefined;
  onApplyTheme?: ((themeId: string) => void) | undefined;
  onEditTheme?: ((themeId: string) => void) | undefined;
  onChangeTheme?: (() => void) | undefined;
  onApplySlideLayout?: ((pageId: string, layoutId: string) => void) | undefined;
  onEditSlideLayout?: ((layoutId: string) => void) | undefined;
  onToggleSlideLayoutPlaceholder?:
    | ((
        layoutId: string,
        role: 'body' | 'footer' | 'slideNumber' | 'title',
        visible: boolean,
      ) => void)
    | undefined;
  onReplaceVideoAsset?: ((elementId: string, file: File) => void) | undefined;
  onClearPageTransition?: (() => void) | undefined;
  onSetPageTransition?: ((transition: SlideTransition) => void) | undefined;
  onSetElementAnimationBuilds?:
    | ((elementIds: string[], patch: Omit<ElementAnimationBuild, 'elementId' | 'id'>) => void)
    | undefined;
  onClearElementAnimationBuild?: ((elementId: string) => void) | undefined;
  onReorderElementAnimationBuild?: ((elementId: string, targetIndex: number) => void) | undefined;
  onPlayAnimationPreview?: (() => void) | undefined;
}

const menuItems: Array<{ id: RightPanelTab; label: string; icon: typeof Layers3 }> = [
  { id: 'layout', label: 'Layout', icon: Layers3 },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'elements', label: 'Elements', icon: Shapes },
  { id: 'design', label: 'Design', icon: Brush },
  { id: 'animations', label: 'Animate', icon: Clapperboard },
  { id: 'ai-tools', label: 'AI Tools', icon: Sparkles },
  { id: 'assets', label: 'Assets', icon: ImagePlus },
];

export function LeftToolPanel({
  activeTab,
  animationPreview,
  activeSlideLanguage,
  focusFontControlKey,
  onTabChange,
  open = false,
  onOpenChange,
  modelStates,
  attentionModelId,
  createImageOptions,
  promptProviderStates,
  translationProviderStates,
  languageDetectionProviderStates,
  translationLanguageOptions,
  availableFonts,
  languageDetectionPreparation,
  translationPreparation,
  translationTargetAttention,
  translationTargetLanguage,
  promptApiAttention,
  promptApiNotice,
  promptPreparation,
  onDownloadModel,
  onDownloadFont,
  onRemoveModel,
  onCreateImageOptionsChange,
  stockGifResults,
  stockImageResults,
  stockMediaError,
  stockMediaProviderState,
  stockMediaRecentItems,
  stockMediaSearchingGifs,
  stockMediaSearchingImages,
  onConfigureStockMedia,
  onImportImage,
  onRemoveAsset,
  onImportMedia,
  onInsertStockMedia,
  onInsertText,
  onInsertShape,
  onSearchStockGifs,
  onSearchStockImages,
  onPreparePromptApi,
  onPrepareLanguageDetectionProvider,
  onPrepareTranslationProvider,
  onPromptProviderChange,
  onLanguageDetectionProviderChange,
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
  onSetSelectedElementZOrder,
  onUpdateElementFrame,
  onUpdateElementStyle,
  onUpdateTextContent,
  onUpdateMediaPlayback,
  onUpdatePageBackground,
  onApplyTheme,
  onEditTheme,
  onChangeTheme,
  onApplySlideLayout,
  onEditSlideLayout,
  onToggleSlideLayoutPlaceholder,
  onReplaceVideoAsset,
  onClearPageTransition,
  onSetPageTransition,
  onSetElementAnimationBuilds,
  onClearElementAnimationBuild,
  onReorderElementAnimationBuild,
  onPlayAnimationPreview,
}: LeftToolPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizeStartRef = useRef<{ pointerX: number; width: number } | undefined>(undefined);
  const [contentWidth, setContentWidth] = useState(266);
  const [resizing, setResizing] = useState(false);
  const isAttentionOpen = Boolean(
    attentionModelId || promptApiAttention || translationTargetAttention,
  );
  const panelOpen = open || isAttentionOpen;
  const assetRows = useMemo(() => {
    if (!panelOpen || activeTab !== 'assets') return [];
    const referencedAssetIds = collectReferencedAssetIds(project);
    return Object.values(project.assets)
      .map((asset) => ({
        asset,
        used: referencedAssetIds.has(asset.id),
      }))
      .sort((a, b) => a.asset.name.localeCompare(b.asset.name, undefined, { sensitivity: 'base' }));
  }, [activeTab, panelOpen, project]);

  useEffect(() => {
    if (!resizing) return undefined;

    function handlePointerMove(event: PointerEvent) {
      const resizeStart = resizeStartRef.current;
      if (!resizeStart) return;
      setContentWidth(
        Math.min(520, Math.max(240, resizeStart.width + event.clientX - resizeStart.pointerX)),
      );
    }

    function handlePointerUp() {
      resizeStartRef.current = undefined;
      setResizing(false);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizing]);

  return (
    <aside
      className={
        panelOpen
          ? resizing
            ? 'left-tool-panel left-tool-panel-open left-tool-panel-resizing'
            : 'left-tool-panel left-tool-panel-open'
          : 'left-tool-panel'
      }
      aria-label="Editor tools"
      data-tour-id="left-tool-panel"
      style={{ '--left-tool-content-width': `${contentWidth}px` } as CSSProperties}
    >
      <nav className="left-tool-rail" aria-label="Tool menu" data-tour-id="left-tool-rail">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = panelOpen && item.id === activeTab;
          return (
            <button
              aria-current={isActive ? 'page' : undefined}
              aria-expanded={isActive}
              aria-selected={isActive}
              className={isActive ? 'left-tool-button left-tool-button-active' : 'left-tool-button'}
              data-tour-id={`left-tool-tab-${item.id}`}
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
            {...(availableFonts ? { availableFonts } : {})}
            {...(focusFontControlKey ? { focusFontControlKey } : {})}
            {...(onDownloadFont ? { onDownloadFont } : {})}
            {...(onAlignSelectedElement ? { onAlignSelectedElement } : {})}
            {...(onSetElementLock ? { onSetElementLock } : {})}
            {...(onSetSelectedElementZOrder ? { onSetSelectedElementZOrder } : {})}
            {...(onUpdateElementFrame ? { onUpdateElementFrame } : {})}
            {...(onUpdateElementStyle ? { onUpdateElementStyle } : {})}
            {...(onUpdateTextContent ? { onUpdateTextContent } : {})}
            {...(onUpdateMediaPlayback ? { onUpdateMediaPlayback } : {})}
            {...(onUpdatePageBackground ? { onUpdatePageBackground } : {})}
            {...(onApplyTheme ? { onApplyTheme } : {})}
            {...(onEditTheme ? { onEditTheme } : {})}
            {...(onChangeTheme ? { onChangeTheme } : {})}
            {...(onApplySlideLayout ? { onApplySlideLayout } : {})}
            {...(onEditSlideLayout ? { onEditSlideLayout } : {})}
            {...(onToggleSlideLayoutPlaceholder ? { onToggleSlideLayoutPlaceholder } : {})}
            {...(onReplaceVideoAsset ? { onReplaceVideoAsset } : {})}
            {...(onSetElementAnimationBuilds ? { onSetElementAnimationBuilds } : {})}
          />
        ) : null}
        {panelOpen && activeTab === 'text' ? (
          <TextPanel {...(onInsertText ? { onInsertText } : {})} />
        ) : null}
        {panelOpen && activeTab === 'elements' ? (
          <ElementsPanel
            {...(onInsertShape ? { onInsertShape } : {})}
            {...(onConfigureStockMedia ? { onConfigureStockMedia } : {})}
            {...(onInsertStockMedia ? { onInsertStockMedia } : {})}
            {...(onSearchStockGifs ? { onSearchStockGifs } : {})}
            {...(onSearchStockImages ? { onSearchStockImages } : {})}
            gifResults={stockGifResults}
            imageResults={stockImageResults}
            loadingGifs={stockMediaSearchingGifs}
            loadingImages={stockMediaSearchingImages}
            recentStockMedia={stockMediaRecentItems}
            stockMediaError={stockMediaError}
            stockMediaProviderState={stockMediaProviderState}
          />
        ) : null}
        {panelOpen && activeTab === 'animations' ? (
          <AnimationPanel
            animationPreview={animationPreview}
            project={project}
            activePageId={activePageId}
            selection={selection}
            {...(onClearPageTransition ? { onClearPageTransition } : {})}
            {...(onSetPageTransition ? { onSetPageTransition } : {})}
            {...(onSetElementAnimationBuilds ? { onSetElementAnimationBuilds } : {})}
            {...(onUpdateMediaPlayback ? { onUpdateMediaPlayback } : {})}
            {...(onClearElementAnimationBuild ? { onClearElementAnimationBuild } : {})}
            {...(onReorderElementAnimationBuild ? { onReorderElementAnimationBuild } : {})}
            {...(onPlayAnimationPreview ? { onPlayAnimationPreview } : {})}
          />
        ) : null}
        {panelOpen && activeTab === 'ai-tools' ? (
          <AiToolsPanel
            activeSlideLanguage={activeSlideLanguage}
            modelStates={modelStates}
            attentionModelId={attentionModelId}
            translationLanguageOptions={translationLanguageOptions}
            promptProviderStates={promptProviderStates}
            translationProviderStates={translationProviderStates}
            languageDetectionProviderStates={languageDetectionProviderStates}
            languageDetectionPreparation={languageDetectionPreparation}
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
            onPrepareLanguageDetectionProvider={onPrepareLanguageDetectionProvider}
            onPrepareTranslationProvider={onPrepareTranslationProvider}
            onPromptProviderChange={onPromptProviderChange}
            onLanguageDetectionProviderChange={onLanguageDetectionProviderChange}
            onTranslationTargetLanguageChange={onTranslationTargetLanguageChange}
            onTranslationProviderChange={onTranslationProviderChange}
            {...(createImageOptions ? { createImageOptions } : {})}
          />
        ) : null}
        {panelOpen && activeTab === 'assets' ? (
          <section className="panel-stack">
            <div className="panel-section ew-panel-card">
              <h2 className="panel-heading">Assets</h2>
              <p className="panel-muted">Imported assets in this project.</p>
            </div>
            <button
              className="compact-action compact-action-full ew-surface ew-surface-hover ew-compact-row"
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                add_photo_alternate
              </span>
              Import Media
            </button>
            <input
              ref={fileInputRef}
              aria-label="Import media file"
              className="visually-hidden-input"
              type="file"
              accept={localMediaImportConfig.accept}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (onImportMedia) {
                  onImportMedia(file);
                } else {
                  onImportImage?.(file);
                }
                event.target.value = '';
              }}
            />
            <div className="asset-list ew-panel-card" aria-label="Project assets">
              {assetRows.length > 0 ? (
                assetRows.map(({ asset, used }) => (
                  <AssetRow
                    asset={asset}
                    key={asset.id}
                    used={used}
                    onRemoveAsset={onRemoveAsset}
                  />
                ))
              ) : (
                <p className="panel-muted">No assets imported yet.</p>
              )}
            </div>
          </section>
        ) : null}
      </div>
      {panelOpen ? (
        <button
          aria-label="Resize design panel"
          className="left-tool-resize-handle"
          type="button"
          onPointerDown={(event) => {
            resizeStartRef.current = {
              pointerX: event.clientX,
              width: contentWidth,
            };
            setResizing(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
        />
      ) : null}
    </aside>
  );
}

function AssetRow({
  asset,
  onRemoveAsset,
  used,
}: {
  asset: Asset;
  onRemoveAsset: ((assetId: string) => void) | undefined;
  used: boolean;
}) {
  const detail = asset.fileName ?? asset.id;
  const storageLabel =
    asset.storage === 'file' ? 'Saved file' : asset.storage === 'remote' ? 'Remote' : 'Inline';
  return (
    <div className="asset-row ew-surface ew-surface-hover">
      <div className="asset-thumb" aria-hidden="true">
        {asset.objectUrl ? (
          <img alt="" src={asset.objectUrl} />
        ) : (
          <span className="material-symbols-outlined">image</span>
        )}
      </div>
      <div className="asset-row-body">
        <div className="asset-row-title-line ew-compact-row">
          <h3 className="asset-row-title ew-ellipsis">{asset.name}</h3>
          <span
            className={used ? 'asset-status asset-status-used' : 'asset-status asset-status-unused'}
          >
            {used ? 'Used' : 'Unused'}
          </span>
        </div>
        <p className="asset-row-meta ew-ellipsis">
          {asset.mimeType} · {storageLabel}
        </p>
        <p className="asset-row-meta ew-ellipsis">{detail}</p>
      </div>
      <button
        aria-label={`Remove ${asset.name}`}
        className="asset-remove-button"
        disabled={used || !onRemoveAsset}
        title={used ? 'This asset is still used in the project' : 'Remove unused asset'}
        type="button"
        onClick={() => {
          onRemoveAsset?.(asset.id);
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          delete
        </span>
      </button>
    </div>
  );
}
