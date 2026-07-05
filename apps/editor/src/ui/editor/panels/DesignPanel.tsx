import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  CaseSensitive,
  ChevronDown,
  Download,
  FileVideo,
  Film,
  FolderOpen,
  Image,
  Plus,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Square,
  Type,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { CSSProperties, FormEvent, RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DesignElement,
  ElementAnimationBuild,
  PageBackground,
  PresentationTheme,
  ProjectDocument,
  SelectionState,
  ShapeElement,
  ShapeLineEndpoint,
  SlideLayout,
  TextElement,
  VideoElement,
  VideoRepeatMode,
} from '../../../domain/documents/model';
import type {
  AlignMode,
  ElementFramePatch,
  ElementStylePatch,
  MediaPlaybackPatch,
  ZOrderMode,
} from '../../../domain/commands/elements/basicCommands';
import type { FontCatalogItem } from '../../../services/contracts/interfaces';
import { PanelSection } from '../../components/PanelSection';
import { textStyleOptions } from '../text/textStyleOptions';

type ElementAnimationPatch = Omit<ElementAnimationBuild, 'elementId' | 'id'>;
type MovieStartTrigger = ElementAnimationBuild['trigger'];

const regularTextWeight = 400;
const boldTextWeight = 800;
const videoRepeatOptions: Array<{ value: VideoRepeatMode; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'loop', label: 'Loop' },
  { value: 'loop-back-and-forth', label: 'Loop back and forth' },
];
const shapeLineEndpointOptions: Array<{ value: ShapeLineEndpoint; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'open-arrow', label: 'Open arrow' },
  { value: 'circle', label: 'Circle' },
  { value: 'open-circle', label: 'Open circle' },
  { value: 'square', label: 'Square' },
  { value: 'open-square', label: 'Open square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'bar', label: 'Bar' },
];
const palette = ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'];

interface DesignPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  availableFonts?: FontCatalogItem[];
  focusFontControlKey?: number | undefined;
  onDownloadFont?: (family: string) => Promise<void>;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
  onUpdateElementFrame?: (elementId: string, patch: ElementFramePatch) => void;
  onUpdateTextContent?: (elementId: string, text: string) => void;
  onUpdateMediaPlayback?: (elementId: string, patch: MediaPlaybackPatch) => void;
  onUpdatePageBackground?: (background: PageBackground) => void;
  onChangeTheme?: () => void;
  onApplyTheme?: (themeId: string) => void;
  onEditTheme?: (themeId: string) => void;
  onApplySlideLayout?: (pageId: string, layoutId: string) => void;
  onEditSlideLayout?: (layoutId: string) => void;
  onAlignSelectedElement?: (mode: AlignMode) => void;
  onSetElementLock?: (elementId: string, locked: boolean) => void;
  onSetSelectedElementZOrder?: (mode: ZOrderMode) => void;
  onReplaceVideoAsset?: (elementId: string, file: File) => void;
  onSetElementAnimationBuilds?: (elementIds: string[], patch: ElementAnimationPatch) => void;
}

function getSelectedElement(
  project: ProjectDocument,
  selection: SelectionState,
): DesignElement | undefined {
  return project.elements[selection.elementIds[0] ?? ''];
}

function getBackgroundColor(background: PageBackground) {
  return background.type === 'color' ? background.color : background.colorFallback;
}

function supportsLineEndpoints(element: ShapeElement) {
  return element.shape === 'arc' || element.shape === 'arrow' || element.shape === 'line';
}

function fontMatchesQuery(font: FontCatalogItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;
  return (
    font.family.toLowerCase().includes(normalizedQuery) ||
    (font.aliases ?? []).some((alias) => alias.toLowerCase().includes(normalizedQuery))
  );
}

function collectDocumentTextFontFamilies(project: ProjectDocument) {
  return Object.values(project.elements)
    .filter((element) => element.type === 'text')
    .map((element) => element.fontFamily);
}

export function DesignPanel({
  project,
  activePageId,
  selection,
  onUpdateElementStyle,
  onUpdateElementFrame,
  onUpdateTextContent,
  onUpdateMediaPlayback,
  onUpdatePageBackground,
  onAlignSelectedElement,
  onSetElementLock,
  onSetSelectedElementZOrder,
  availableFonts = [],
  focusFontControlKey,
  onDownloadFont,
  onReplaceVideoAsset,
  onSetElementAnimationBuilds,
  onChangeTheme,
  onApplyTheme,
  onEditTheme,
  onApplySlideLayout,
  onEditSlideLayout,
}: DesignPanelProps) {
  const fontSelectRef = useRef<HTMLSelectElement>(null);
  const [fontDownloadOpen, setFontDownloadOpen] = useState(false);
  const [themeGalleryOpen, setThemeGalleryOpen] = useState(false);
  const [fontSearchInput, setFontSearchInput] = useState('');
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [downloadingFontFamily, setDownloadingFontFamily] = useState<string | undefined>();
  const [fontDownloadStatus, setFontDownloadStatus] = useState<string | undefined>();
  const page = project.pages.find((item) => item.id === activePageId);
  const selectedElement = getSelectedElement(project, selection);
  const selectionTarget = selectedElement ? 'elements' : (selection.target ?? 'presentation');
  const backgroundColor = page ? getBackgroundColor(page.background) : '#050D10';
  const projectFontFamilies = useMemo(
    () =>
      Array.from(
        new Set([
          ...Object.values(project.fonts ?? {}).map((font) => font.family),
          ...collectDocumentTextFontFamilies(project),
        ]),
      ).sort(),
    [project],
  );
  const fontFamilyOptions = useMemo(
    () =>
      Array.from(
        new Set([...textStyleOptions.TEXT_FONT_FAMILIES, ...projectFontFamilies]),
      ).sort((left, right) => left.localeCompare(right)),
    [projectFontFamilies],
  );
  const filteredDownloadableFonts = useMemo(() => {
    const query = fontSearchQuery.trim();
    return availableFonts
      .filter((font) => fontMatchesQuery(font, query))
      .slice(0, 12);
  }, [availableFonts, fontSearchQuery]);

  useEffect(() => {
    if (!focusFontControlKey || selectedElement?.type !== 'text') return;
    fontSelectRef.current?.focus();
  }, [focusFontControlKey, selectedElement?.type]);

  function updateSelectedStyle(patch: Parameters<NonNullable<typeof onUpdateElementStyle>>[1]) {
    if (!selectedElement || selectedElement.locked) return;
    onUpdateElementStyle?.(selectedElement.id, patch);
  }

  function updateSelectedMediaPlayback(patch: MediaPlaybackPatch) {
    if (!selectedElement || selectedElement.locked) return;
    if (selectedElement.type !== 'gif' && selectedElement.type !== 'video') return;
    onUpdateMediaPlayback?.(selectedElement.id, patch);
  }

  async function downloadFont(family: string) {
    if (!family || !onDownloadFont) return;
    setDownloadingFontFamily(family);
    setFontDownloadStatus(`Downloading ${family}...`);
    try {
      await onDownloadFont(family);
      setFontDownloadStatus(`${family} downloaded and applied`);
    } catch (error) {
      setFontDownloadStatus(error instanceof Error ? error.message : 'Font download failed.');
    } finally {
      setDownloadingFontFamily(undefined);
    }
  }

  function submitFontSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFontSearchQuery(fontSearchInput.trim());
  }

  function applyColor(color: string) {
    if (selectedElement?.type === 'text' || selectedElement?.type === 'shape') {
      updateSelectedStyle({ fill: color });
      return;
    }
    onUpdatePageBackground?.({ type: 'color', color });
  }

  return (
    <div className="panel-stack">
      {selectionTarget === 'presentation' ? (
        <PresentationDesignInspector
          project={project}
          themeGalleryOpen={themeGalleryOpen}
          onApplyTheme={onApplyTheme}
          onChangeTheme={() => {
            setThemeGalleryOpen((current) => !current);
            onChangeTheme?.();
          }}
          onEditTheme={onEditTheme}
        />
      ) : null}

      {selectionTarget === 'slide' && page ? (
        <SlideDesignInspector
          page={page}
          project={project}
          onApplySlideLayout={onApplySlideLayout}
          onEditSlideLayout={onEditSlideLayout}
          onUpdatePageBackground={onUpdatePageBackground}
        />
      ) : null}

      {selectionTarget === 'elements' && selectedElement ? (
        <>
          <PanelSection title="Canvas">
            <div className="property-row ew-surface ew-surface-hover ew-compact-row">
              <span>Format</span>
              <strong>{page ? `${page.width} x ${page.height}` : 'No page'}</strong>
            </div>
            <label className="design-control ew-field-scope">
              <span>Background</span>
              <input
                aria-label="Canvas background color"
                type="color"
                value={backgroundColor}
                onChange={(event) => {
                  onUpdatePageBackground?.({ type: 'color', color: event.target.value });
                }}
              />
            </label>
          </PanelSection>
          <PanelSection title="Palette">
            <div className="palette-row">
              {palette.map((color) => (
                <button
                  key={color}
                  aria-label={`Apply ${color}`}
                  className="color-swatch"
                  style={{ backgroundColor: color }}
                  type="button"
                  onClick={() => {
                    applyColor(color);
                  }}
                />
              ))}
            </div>
          </PanelSection>
          <ElementDesignInspector
            key={selectedElement.id}
            assetName={
              selectedElement.type === 'image' ||
              selectedElement.type === 'gif' ||
              selectedElement.type === 'video'
                ? project.assets[selectedElement.assetId]?.name
                : undefined
            }
            element={selectedElement}
            onAlign={onAlignSelectedElement}
            onFrameUpdate={(patch) => onUpdateElementFrame?.(selectedElement.id, patch)}
            onLockChange={(locked) => onSetElementLock?.(selectedElement.id, locked)}
            onReplaceVideoAsset={(file) => onReplaceVideoAsset?.(selectedElement.id, file)}
            {...(onSetElementAnimationBuilds ? { onSetElementAnimationBuilds } : {})}
            onTextContentChange={(text) => onUpdateTextContent?.(selectedElement.id, text)}
            onUpdateMedia={updateSelectedMediaPlayback}
            onUpdateStyle={updateSelectedStyle}
            page={page}
            onZOrderChange={onSetSelectedElementZOrder}
            textStyleControls={
              selectedElement.type === 'text'
                ? {
                    downloadingFontFamily,
                    filteredDownloadableFonts,
                    fontDownloadOpen,
                    fontDownloadStatus,
                    fontFamilyOptions,
                    fontSearchInput,
                    fontSearchQuery,
                    fontSelectRef,
                    hasFontDownload: Boolean(onDownloadFont),
                    onDownloadFontFamily: downloadFont,
                    onFontSearchInputChange: (value) => {
                      setFontSearchInput(value);
                      setFontSearchQuery(value.trim());
                    },
                    onFontSearchSubmit: submitFontSearch,
                    onToggleFontDownload: () => {
                      setFontDownloadOpen((current) => !current);
                    },
                  }
                : undefined
            }
          />
        </>
      ) : null}

      {selectionTarget === 'elements' && !selectedElement ? (
        <PanelSection title="Selection">
          <div className="compact-action design-selection-summary ew-surface ew-surface-hover ew-compact-row">
            <CaseSensitive size={16} />
            <span>No selected element</span>
          </div>
        </PanelSection>
      ) : null}
    </div>
  );
}

interface PresentationDesignInspectorProps {
  project: ProjectDocument;
  themeGalleryOpen: boolean;
  onApplyTheme?: ((themeId: string) => void) | undefined;
  onChangeTheme: () => void;
  onEditTheme?: ((themeId: string) => void) | undefined;
}

interface SlideDesignInspectorProps {
  page: ProjectDocument['pages'][number];
  project: ProjectDocument;
  onApplySlideLayout?: ((pageId: string, layoutId: string) => void) | undefined;
  onEditSlideLayout?: ((layoutId: string) => void) | undefined;
  onUpdatePageBackground?: ((background: PageBackground) => void) | undefined;
}

function getActiveTheme(project: ProjectDocument): PresentationTheme {
  const themeId = project.themeId ?? project.themeGallery?.[0];
  const theme = themeId ? project.themes?.[themeId] : undefined;
  return (
    theme ?? {
      id: 'theme-localstudio',
      name: 'LocalStudio',
      palette: {
        background: '#050D10',
        text: '#FFFFFF',
        primary: '#37FD76',
        secondary: '#36D7FF',
        muted: '#91999D',
      },
      typography: {
        bodyFontFamily: 'Open Sans',
        displayFontFamily: 'Orbitron',
      },
      preview: { background: '#050D10', accents: ['#37FD76', '#36D7FF'] },
      source: 'system',
    }
  );
}

function getThemeGallery(project: ProjectDocument) {
  const themes = project.themes ?? {};
  const ids = project.themeGallery?.length ? project.themeGallery : Object.keys(themes);
  return ids.map((themeId) => themes[themeId]).filter((theme): theme is PresentationTheme => Boolean(theme));
}

function TemplatePreview({ background, accents }: { background: string; accents: string[] }) {
  return (
    <span className="template-preview" style={{ background }}>
      <span style={{ background: accents[0] ?? '#37FD76' }} />
      <span style={{ background: accents[1] ?? '#36D7FF' }} />
    </span>
  );
}

interface LayoutThumbnailSource {
  background: PageBackground;
  elements: DesignElement[];
  height: number;
  width: number;
}

function getProjectElements(project: ProjectDocument, elementIds: string[]) {
  return elementIds
    .map((elementId) => project.elements[elementId])
    .filter((element): element is DesignElement => Boolean(element));
}

function getLayoutThumbnailSource(project: ProjectDocument, layout: SlideLayout): LayoutThumbnailSource {
  const linkedPage = project.pages.find((page) => page.layoutId === layout.id);
  if (layout.elements.length > 0) {
    return {
      background: layout.background,
      elements: layout.elements,
      height: linkedPage?.height ?? 1080,
      width: linkedPage?.width ?? 1920,
    };
  }

  if (linkedPage) {
    return {
      background: linkedPage.background,
      elements: getProjectElements(project, linkedPage.elementIds),
      height: linkedPage.height,
      width: linkedPage.width,
    };
  }

  return {
    background: layout.background,
    elements: [],
    height: 1080,
    width: 1920,
  };
}

function getThumbnailBackgroundStyle(project: ProjectDocument, background: PageBackground): CSSProperties {
  if (background.type === 'color') return { background: background.color };
  const asset = project.assets[background.assetId];
  return {
    backgroundColor: background.colorFallback,
    backgroundImage: asset?.objectUrl ? `url(${asset.objectUrl})` : undefined,
  };
}

function getThumbnailElementStyle(element: DesignElement, source: LayoutThumbnailSource): CSSProperties {
  return {
    height: `${(element.height / source.height) * 100}%`,
    left: `${(element.x / source.width) * 100}%`,
    opacity: element.opacity,
    top: `${(element.y / source.height) * 100}%`,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    width: `${(element.width / source.width) * 100}%`,
  };
}

function getThumbnailTextStyle(element: TextElement, source: LayoutThumbnailSource): CSSProperties {
  const fontSize = Math.max(3, Math.min(11, (element.fontSize / source.height) * 62));
  return {
    ...getThumbnailElementStyle(element, source),
    color: element.fill,
    fontFamily: element.fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: element.fontWeight,
    justifyContent:
      element.verticalAlign === 'bottom' ? 'flex-end' : element.verticalAlign === 'middle' ? 'center' : 'flex-start',
    textAlign: element.align,
  };
}

function renderLayoutThumbnailElement(
  project: ProjectDocument,
  source: LayoutThumbnailSource,
  element: DesignElement,
) {
  if (!element.visible) return null;
  const baseStyle = getThumbnailElementStyle(element, source);

  if (element.type === 'text') {
    return (
      <span className="layout-thumbnail-text" key={element.id} style={getThumbnailTextStyle(element, source)}>
        {element.text}
      </span>
    );
  }

  if (element.type === 'shape') {
    const isLine = element.shape === 'arrow' || element.shape === 'line';
    return (
      <span
        className={isLine ? 'layout-thumbnail-shape layout-thumbnail-line' : 'layout-thumbnail-shape'}
        key={element.id}
        style={{
          ...baseStyle,
          background: isLine ? element.stroke ?? element.fill ?? '#37FD76' : element.fill ?? 'transparent',
          borderColor: element.stroke ?? element.fill ?? 'rgba(255, 255, 255, 0.7)',
          borderRadius: element.shape === 'ellipse' ? '999px' : element.shape === 'rounded-rect' ? '4px' : '1px',
          borderWidth: element.stroke ? 1 : 0,
        }}
      />
    );
  }

  const asset = project.assets[element.assetId];
  if (asset?.objectUrl && (element.type === 'gif' || element.type === 'image')) {
    return (
      <img alt="" className="layout-thumbnail-media" key={element.id} src={asset.objectUrl} style={baseStyle} />
    );
  }

  return (
    <span className="layout-thumbnail-media layout-thumbnail-media-fallback" key={element.id} style={baseStyle}>
      {element.type === 'video' ? 'Video' : 'Media'}
    </span>
  );
}

function LayoutThumbnail({ layout, project }: { layout: SlideLayout; project: ProjectDocument }) {
  const source = getLayoutThumbnailSource(project, layout);

  return (
    <span className="layout-thumbnail" style={getThumbnailBackgroundStyle(project, source.background)}>
      {source.elements.length > 0 ? (
        source.elements.map((element) => renderLayoutThumbnailElement(project, source, element))
      ) : (
        <span className="layout-thumbnail-empty">{layout.name}</span>
      )}
    </span>
  );
}

function PresentationDesignInspector({
  project,
  themeGalleryOpen,
  onApplyTheme,
  onChangeTheme,
  onEditTheme,
}: PresentationDesignInspectorProps) {
  const activeTheme = getActiveTheme(project);
  const themes = getThemeGallery(project);

  return (
    <>
      <PanelSection title="Theme">
        <div className="theme-current-card ew-surface">
          <TemplatePreview
            background={activeTheme.preview.background}
            accents={activeTheme.preview.accents}
          />
          <div className="theme-current-copy">
            <span>Current theme</span>
            <strong>{activeTheme.name}</strong>
          </div>
        </div>
        <div className="template-action-row">
          <button className="compact-action ew-surface ew-surface-hover" type="button" onClick={onChangeTheme}>
            Change Theme
          </button>
          <button
            aria-label="Edit theme"
            className="compact-action ew-surface ew-surface-hover"
            type="button"
            onClick={() => onEditTheme?.(activeTheme.id)}
          >
            Edit
          </button>
          <button
            className="compact-action ew-surface ew-surface-hover"
            type="button"
            onClick={() => onApplyTheme?.(activeTheme.id)}
          >
            Apply Theme
          </button>
        </div>
      </PanelSection>
      {themeGalleryOpen ? (
        <PanelSection title="Gallery">
          <div className="theme-gallery" role="region" aria-label="Theme gallery">
            {themes.map((theme) => (
              <button
                aria-label={`Choose ${theme.name} theme`}
                className={
                  theme.id === activeTheme.id
                    ? 'theme-gallery-item theme-gallery-item-active ew-surface'
                    : 'theme-gallery-item ew-surface ew-surface-hover'
                }
                key={theme.id}
                type="button"
                onClick={() => onApplyTheme?.(theme.id)}
              >
                <TemplatePreview background={theme.preview.background} accents={theme.preview.accents} />
                <span>{theme.name}</span>
              </button>
            ))}
          </div>
        </PanelSection>
      ) : null}
    </>
  );
}

function SlideDesignInspector({
  page,
  project,
  onApplySlideLayout,
  onEditSlideLayout,
  onUpdatePageBackground,
}: SlideDesignInspectorProps) {
  const [layoutGalleryOpen, setLayoutGalleryOpen] = useState(false);
  const layouts = Object.values(project.slideLayouts ?? {});
  const currentLayout = page.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
  const layout = currentLayout ?? layouts[0];
  const backgroundColor = getBackgroundColor(page.background);
  const layoutButtonLabel = `Slide layout: ${layout?.name ?? 'Custom'}`;

  return (
    <>
      <PanelSection title="Slide">
        <div className="layout-picker-shell">
          <button
            aria-expanded={layoutGalleryOpen}
            aria-label={layoutButtonLabel}
            className="theme-current-card layout-current-button ew-surface ew-surface-hover"
            type="button"
            onClick={() => setLayoutGalleryOpen((isOpen) => !isOpen)}
          >
            {layout ? (
              <LayoutThumbnail layout={layout} project={project} />
            ) : (
              <TemplatePreview background={backgroundColor} accents={['#37FD76']} />
            )}
            <div className="theme-current-copy">
              <span>Slide layout</span>
              <strong>{layout?.name ?? 'Custom'}</strong>
            </div>
            <ChevronDown size={16} aria-hidden />
          </button>
          {layoutGalleryOpen ? (
            <div className="layout-gallery-popover ew-surface" role="region" aria-label="Slide layout gallery">
              <span className="layout-gallery-caret" aria-hidden />
              <div className="layout-gallery-title">Choose a layout</div>
              <div className="layout-gallery-grid">
                {layouts.map((item) => (
                  <button
                    aria-pressed={item.id === layout?.id}
                    className={
                      item.id === layout?.id
                        ? 'layout-gallery-item layout-gallery-item-active'
                        : 'layout-gallery-item'
                    }
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onApplySlideLayout?.(page.id, item.id);
                      setLayoutGalleryOpen(false);
                    }}
                  >
                    <LayoutThumbnail layout={item} project={project} />
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </PanelSection>
      <PanelSection title="Appearance">
        <div className="template-toggle-list">
          {(layout?.placeholderRoles ?? ['title', 'body']).map((role) => (
            <label className="template-checkbox-row" key={role}>
              <input aria-label={`Slide ${role} placeholder`} defaultChecked type="checkbox" />
              <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
            </label>
          ))}
        </div>
      </PanelSection>
      <PanelSection title="Background">
        <div className="movie-inspector-tabs" role="tablist" aria-label="Slide background mode">
          <button aria-selected className="movie-inspector-tab movie-inspector-tab-active" role="tab" type="button">
            Standard
          </button>
          <button aria-selected={false} className="movie-inspector-tab" role="tab" type="button">
            Dynamic
          </button>
        </div>
        <label className="design-control ew-field-scope">
          <span>Current Fill</span>
          <input
            aria-label="Slide background color"
            type="color"
            value={backgroundColor}
            onChange={(event) => onUpdatePageBackground?.({ type: 'color', color: event.target.value })}
          />
        </label>
        <button
          className="compact-action compact-action-full ew-surface ew-surface-hover"
          type="button"
          onClick={() => layout && onEditSlideLayout?.(layout.id)}
        >
          Edit Slide Layout
        </button>
      </PanelSection>
    </>
  );
}

interface ElementDesignInspectorProps {
  assetName?: string | undefined;
  element: DesignElement;
  onAlign?: ((mode: AlignMode) => void) | undefined;
  onFrameUpdate?: ((patch: ElementFramePatch) => void) | undefined;
  onLockChange?: ((locked: boolean) => void) | undefined;
  onReplaceVideoAsset?: ((file: File) => void) | undefined;
  onSetElementAnimationBuilds?: (elementIds: string[], patch: ElementAnimationPatch) => void;
  onTextContentChange?: ((text: string) => void) | undefined;
  onUpdateMedia: (patch: MediaPlaybackPatch) => void;
  onUpdateStyle: (patch: ElementStylePatch) => void;
  page?: ProjectDocument['pages'][number] | undefined;
  onZOrderChange?: ((mode: ZOrderMode) => void) | undefined;
  textStyleControls?: TextStyleControls | undefined;
}

interface TextStyleControls {
  downloadingFontFamily?: string | undefined;
  filteredDownloadableFonts: FontCatalogItem[];
  fontDownloadOpen: boolean;
  fontDownloadStatus?: string | undefined;
  fontFamilyOptions: string[];
  fontSearchInput: string;
  fontSearchQuery: string;
  fontSelectRef: RefObject<HTMLSelectElement | null>;
  hasFontDownload: boolean;
  onDownloadFontFamily: (family: string) => Promise<void>;
  onFontSearchInputChange: (value: string) => void;
  onFontSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleFontDownload: () => void;
}

function toTrimSeconds(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getTrimSliderMax(element: VideoElement) {
  return Math.max(
    1,
    Math.ceil(element.durationSeconds ?? 0),
    Math.ceil(element.trimStartSeconds),
    Math.ceil(element.trimEndSeconds ?? 0),
    Math.ceil(element.posterFrameSeconds ?? 0),
  );
}

function formatMovieTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const totalMilliseconds = Math.round(safeSeconds * 1000);
  const milliseconds = (totalMilliseconds % 1000).toString().padStart(3, '0');
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const displaySeconds = (totalSeconds % 60).toString().padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const displayMinutes = (totalMinutes % 60).toString().padStart(2, '0');
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  return `${hours}:${displayMinutes}:${displaySeconds},${milliseconds}`;
}

function getVideoRepeatMode(element: VideoElement): VideoRepeatMode {
  return element.repeatMode ?? (element.loop ? 'loop' : 'none');
}

function getTrimEndSeconds(element: VideoElement) {
  return element.trimEndSeconds ?? element.durationSeconds ?? getTrimSliderMax(element);
}

function getMovieStartValue(
  mediaStartBuild: ElementAnimationBuild | undefined,
  videoElement: VideoElement | undefined,
) {
  if (mediaStartBuild) {
    return mediaStartBuild.trigger;
  }
  return videoElement?.startOnClick ? 'on-click' : 'after-transition';
}

function toMovieStartTrigger(value: string): MovieStartTrigger {
  if (value === 'after-transition' || value === 'after-previous') return value;
  return 'on-click';
}

type ElementInspectorTab = 'arrange' | 'content' | 'style';

function getBoundedNumber(value: string, fallback: number, minimum = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function getElementContentTabLabel(element: DesignElement) {
  if (element.type === 'text') return 'Text';
  if (element.type === 'gif' || element.type === 'video') return 'Movie';
  if (element.type === 'shape') return 'Shape';
  return 'Image';
}

function getElementIcon(element: DesignElement) {
  if (element.type === 'text') return <Type size={16} />;
  if (element.type === 'image') return <Image size={16} />;
  if (element.type === 'gif') return <Film size={16} />;
  if (element.type === 'video') return <Video size={16} />;
  return <Square size={16} />;
}

function TextStyleInspector({
  downloadingFontFamily,
  element,
  filteredDownloadableFonts,
  fontDownloadOpen,
  fontDownloadStatus,
  fontFamilyOptions,
  fontSearchInput,
  fontSearchQuery,
  fontSelectRef,
  hasFontDownload,
  onDownloadFontFamily,
  onFontSearchInputChange,
  onFontSearchSubmit,
  onToggleFontDownload,
  onUpdateStyle,
}: TextStyleControls & {
  element: TextElement;
  onUpdateStyle: (patch: ElementStylePatch) => void;
}) {
  const selectedTextIsBold = element.fontWeight >= boldTextWeight;

  return (
    <section className="movie-panel-section" aria-label="Selected text controls">
      <h3>Typography</h3>
      <div className="text-inspector-stack">
        <div className="font-control-row">
          <label className="text-inspector-field ew-field-scope ew-grid-compact text-inspector-field-full">
            <span className="text-inspector-label ew-strong-label">Font</span>
            <select
              aria-label="Selected text font"
              ref={fontSelectRef}
              value={element.fontFamily}
              onChange={(event) => {
                onUpdateStyle({ fontFamily: event.target.value });
              }}
            >
              {fontFamilyOptions.map((fontFamily) => (
                <option key={fontFamily} value={fontFamily}>
                  {fontFamily}
                </option>
              ))}
            </select>
          </label>
          <button
            aria-expanded={fontDownloadOpen}
            aria-label="Download additional font"
            className="font-add-button"
            title="Download additional font"
            type="button"
            onClick={onToggleFontDownload}
          >
            <Plus size={16} />
          </button>
        </div>
        {fontDownloadOpen ? (
          <div className="font-download-panel">
            <form className="font-download-search" onSubmit={onFontSearchSubmit}>
              <label className="layer-search font-download-search-box ew-surface ew-compact-row">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search downloadable fonts"
                  placeholder="Search Google Fonts"
                  type="search"
                  value={fontSearchInput}
                  onChange={(event) => {
                    onFontSearchInputChange(event.target.value);
                  }}
                />
              </label>
              <button className="font-search-submit" type="submit" aria-label="Search fonts">
                <Search size={16} />
              </button>
            </form>
            {fontSearchQuery ? (
              <div className="font-download-results" aria-label="Downloadable font results">
                {filteredDownloadableFonts.length > 0 ? (
                  filteredDownloadableFonts.map((font) => (
                    <button
                      aria-label={`Download ${font.family}`}
                      className="font-download-result"
                      disabled={!hasFontDownload || downloadingFontFamily === font.family}
                      key={font.family}
                      type="button"
                      onClick={() => {
                        void onDownloadFontFamily(font.family);
                      }}
                    >
                      <span className="ew-ellipsis">{font.family}</span>
                      <Download size={15} />
                    </button>
                  ))
                ) : (
                  <p className="panel-muted">No Google Fonts match that search.</p>
                )}
              </div>
            ) : null}
            {fontDownloadStatus ? (
              <div className="panel-muted" role="status">
                {fontDownloadStatus}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="text-inspector-pair">
          <label className="text-inspector-field ew-field-scope ew-grid-compact">
            <span className="text-inspector-label ew-strong-label">Weight</span>
            <select
              aria-label="Selected text font weight"
              value={element.fontWeight}
              onChange={(event) => {
                onUpdateStyle({ fontWeight: Number(event.target.value) });
              }}
            >
              {textStyleOptions.TEXT_FONT_WEIGHTS.map((fontWeight) => (
                <option key={fontWeight} value={fontWeight}>
                  {fontWeight}
                </option>
              ))}
            </select>
          </label>
          <label className="text-inspector-field ew-field-scope ew-grid-compact">
            <span className="text-inspector-label ew-strong-label">Size</span>
            <input
              aria-label="Selected text font size"
              min="1"
              type="number"
              value={element.fontSize}
              onChange={(event) => {
                onUpdateStyle({ fontSize: Number(event.target.value) });
              }}
            />
          </label>
        </div>
        <div className="text-style-row" aria-label="Text style controls">
          <button
            aria-label="Bold selected text"
            aria-pressed={selectedTextIsBold}
            className={selectedTextIsBold ? 'text-style-toggle active' : 'text-style-toggle'}
            type="button"
            onClick={() => {
              onUpdateStyle({
                fontWeight: selectedTextIsBold ? regularTextWeight : boldTextWeight,
              });
            }}
          >
            <Bold size={16} />
          </button>
          <button className="text-style-toggle" disabled type="button" aria-label="Italic unavailable">
            <span>I</span>
          </button>
          <button className="text-style-toggle" disabled type="button" aria-label="Underline unavailable">
            <span>U</span>
          </button>
          <button className="text-style-toggle" disabled type="button" aria-label="Strikethrough unavailable">
            <span>S</span>
          </button>
        </div>
        <label className="text-color-row">
          <span>Text Color</span>
          <input
            aria-label="Selected text color"
            type="color"
            value={element.fill}
            onChange={(event) => {
              onUpdateStyle({ fill: event.target.value });
            }}
          />
        </label>
        <div className="text-align-grid" aria-label="Selected text alignment">
          {([
            { align: 'left' as const, icon: AlignLeft, label: 'Align selected text left' },
            { align: 'center' as const, icon: AlignCenter, label: 'Align selected text center' },
            { align: 'right' as const, icon: AlignRight, label: 'Align selected text right' },
          ]).map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-label={item.label}
                aria-pressed={element.align === item.align}
                className={element.align === item.align ? 'text-align-button active' : 'text-align-button'}
                key={item.align}
                type="button"
                onClick={() => {
                  onUpdateStyle({ align: item.align });
                }}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ElementDesignInspector({
  assetName,
  element,
  onAlign,
  onFrameUpdate,
  onLockChange,
  onReplaceVideoAsset,
  onSetElementAnimationBuilds,
  onTextContentChange,
  onUpdateMedia,
  onUpdateStyle,
  page,
  onZOrderChange,
  textStyleControls,
}: ElementDesignInspectorProps) {
  const defaultTab = element.type === 'text' || element.type === 'shape' ? 'style' : 'content';
  const [activeTab, setActiveTab] = useState<ElementInspectorTab>(defaultTab);
  const replaceVideoInputRef = useRef<HTMLInputElement>(null);
  const contentLabel = getElementContentTabLabel(element);
  const locked = element.locked;
  const videoElement = element.type === 'video' ? element : undefined;
  const trimSliderMax = videoElement ? getTrimSliderMax(videoElement) : 1;
  const trimEndSeconds = videoElement ? getTrimEndSeconds(videoElement) : 0;
  const volume = videoElement?.muted ? 0 : Math.round((videoElement?.volume ?? 1) * 100);
  const repeatMode = videoElement ? getVideoRepeatMode(videoElement) : 'none';
  const mediaStartBuild =
    videoElement && page
      ? page.animationBuilds?.find(
          (build) => build.elementId === videoElement.id && build.mediaAction === 'play',
        )
      : undefined;
  const movieStart = getMovieStartValue(mediaStartBuild, videoElement);

  function setMovieStart(trigger: MovieStartTrigger) {
    if (!videoElement) return;
    onSetElementAnimationBuilds?.([videoElement.id], {
      effect: 'reveal',
      trigger,
      delayMs: 0,
      durationMs: 0,
      mediaAction: 'play',
    });
    onUpdateMedia({ autoplayInPreview: true, startOnClick: trigger === 'on-click' });
  }

  return (
    <PanelSection title={contentLabel}>
      <div className="movie-inspector-tabs" role="tablist" aria-label="Movie inspector sections">
        <button
          aria-selected={activeTab === 'style'}
          className={
            activeTab === 'style'
              ? 'movie-inspector-tab movie-inspector-tab-active'
              : 'movie-inspector-tab'
          }
          role="tab"
          type="button"
          onClick={() => setActiveTab('style')}
        >
          Style
        </button>
        <button
          aria-selected={activeTab === 'content'}
          className={
            activeTab === 'content'
              ? 'movie-inspector-tab movie-inspector-tab-active'
              : 'movie-inspector-tab'
          }
          role="tab"
          type="button"
          onClick={() => setActiveTab('content')}
        >
          {contentLabel}
        </button>
        <button
          aria-selected={activeTab === 'arrange'}
          className={
            activeTab === 'arrange'
              ? 'movie-inspector-tab movie-inspector-tab-active'
              : 'movie-inspector-tab'
          }
          role="tab"
          type="button"
          onClick={() => setActiveTab('arrange')}
        >
          Arrange
        </button>
      </div>

      {activeTab === 'style' ? (
        <>
          {element.type === 'text' && textStyleControls ? (
            <TextStyleInspector
              element={element}
              onUpdateStyle={onUpdateStyle}
              {...textStyleControls}
            />
          ) : null}
          {element.type === 'shape' ? (
            <section className="movie-panel-section" aria-label="Selected shape controls">
              <h3>Shape</h3>
              <label className="design-control ew-field-scope">
                <span>Fill</span>
                <select
                  aria-label="Selected shape fill mode"
                  value={element.fill ? 'color' : 'none'}
                  onChange={(event) => {
                    onUpdateStyle({
                      fill: event.target.value === 'color' ? (element.fill ?? '#37FD76') : null,
                    });
                  }}
                >
                  <option value="none">No fill</option>
                  <option value="color">Color fill</option>
                </select>
              </label>
              {element.fill ? (
                <label className="design-control ew-field-scope">
                  <span>Fill color</span>
                  <input
                    aria-label="Selected shape fill color"
                    type="color"
                    value={element.fill}
                    onChange={(event) => {
                      onUpdateStyle({ fill: event.target.value });
                    }}
                  />
                </label>
              ) : null}
              <label className="design-control ew-field-scope">
                <span>Border</span>
                <select
                  aria-label="Selected shape border mode"
                  value={element.stroke && (element.strokeWidth ?? 0) > 0 ? 'color' : 'none'}
                  onChange={(event) => {
                    onUpdateStyle(
                      event.target.value === 'color'
                        ? {
                            stroke: element.stroke ?? '#37FD76',
                            strokeWidth:
                              element.strokeWidth && element.strokeWidth > 0
                                ? element.strokeWidth
                                : 2,
                          }
                        : { stroke: null, strokeWidth: 0 },
                    );
                  }}
                >
                  <option value="none">No border</option>
                  <option value="color">Color border</option>
                </select>
              </label>
              {element.stroke && (element.strokeWidth ?? 0) > 0 ? (
                <>
                  <label className="design-control ew-field-scope">
                    <span>Border color</span>
                    <input
                      aria-label="Selected shape border color"
                      type="color"
                      value={element.stroke}
                      onChange={(event) => {
                        onUpdateStyle({ stroke: event.target.value });
                      }}
                    />
                  </label>
                  <label className="design-control ew-field-scope">
                    <span>Border width</span>
                    <input
                      aria-label="Selected shape border width"
                      min="1"
                      type="number"
                      value={element.strokeWidth ?? 2}
                      onChange={(event) => {
                        onUpdateStyle({ strokeWidth: Number(event.target.value) });
                      }}
                    />
                  </label>
                  {supportsLineEndpoints(element) ? (
                    <>
                      <label className="design-control ew-field-scope">
                        <span>Start endpoint</span>
                        <select
                          aria-label="Selected shape start endpoint"
                          value={element.startEndpoint ?? 'none'}
                          onChange={(event) => {
                            onUpdateStyle({
                              startEndpoint: event.target.value as ShapeLineEndpoint,
                            });
                          }}
                        >
                          {shapeLineEndpointOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="design-control ew-field-scope">
                        <span>End endpoint</span>
                        <select
                          aria-label="Selected shape end endpoint"
                          value={element.endEndpoint ?? (element.shape === 'arrow' ? 'arrow' : 'none')}
                          onChange={(event) => {
                            onUpdateStyle({
                              endEndpoint: event.target.value as ShapeLineEndpoint,
                            });
                          }}
                        >
                          {shapeLineEndpointOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
                </>
              ) : null}
            </section>
          ) : null}
          <section className="movie-panel-section" aria-label="Selected element style">
            <h3>Selection</h3>
            <div className="compact-action design-selection-summary ew-surface ew-surface-hover ew-compact-row">
              {getElementIcon(element)}
              <span>Selected {element.type}</span>
            </div>
            <label className="design-control ew-field-scope">
              <span>Opacity</span>
              <input
                aria-label="Selected element opacity"
                max="100"
                min="0"
                type="range"
                value={Math.round(element.opacity * 100)}
                onChange={(event) => {
                  onUpdateStyle({ opacity: Number(event.target.value) / 100 });
                }}
              />
            </label>
          </section>
        </>
      ) : null}

      {activeTab === 'content' ? (
        <>
          {videoElement ? (
            <>
          <section className="movie-panel-section" aria-label="Movie file info">
            <h3>File Info</h3>
            <div className="movie-file-row">
              <FileVideo size={18} aria-hidden="true" />
              <span className="ew-ellipsis">{assetName}</span>
              <button
                className="stitch-icon-button"
                type="button"
                aria-label="Replace movie file"
                onClick={() => replaceVideoInputRef.current?.click()}
              >
                <FolderOpen size={18} aria-hidden="true" />
              </button>
              <input
                ref={replaceVideoInputRef}
                aria-label="Replace video file"
                accept="video/*"
                className="visually-hidden-input"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onReplaceVideoAsset?.(file);
                  event.target.value = '';
                }}
              />
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Movie controls">
            <h3>Controls</h3>
            <div className="movie-controls-row">
              <button
                type="button"
                aria-label="Jump movie to beginning"
                onClick={() =>
                  onUpdateMedia({
                    playbackPositionSeconds: videoElement.trimStartSeconds,
                    playing: false,
                  })
                }
              >
                <SkipBack size={18} aria-hidden="true" />
              </button>
              <button
                className="movie-play-button"
                type="button"
                aria-label={videoElement.playing ? 'Pause movie' : 'Play movie'}
                aria-pressed={Boolean(videoElement.playing)}
                onClick={() => onUpdateMedia({ playing: !videoElement.playing })}
              >
                {videoElement.playing ? (
                  <Pause size={24} aria-hidden="true" />
                ) : (
                  <Play size={24} aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                aria-label="Jump movie to end"
                onClick={() =>
                  onUpdateMedia({
                    playbackPositionSeconds: trimEndSeconds,
                    playing: false,
                  })
                }
              >
                <SkipForward size={18} aria-hidden="true" />
              </button>
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Movie volume">
            <h3>Volume</h3>
            <div className="movie-volume-row">
              <VolumeX size={18} aria-hidden="true" />
              <input
                aria-label="Selected video volume"
                className="ew-range-input"
                max="100"
                min="0"
                step="1"
                type="range"
                value={volume}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  onUpdateMedia({ muted: nextVolume === 0, volume: nextVolume / 100 });
                }}
              />
              <Volume2 size={20} aria-hidden="true" />
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Edit movie">
            <h3>Edit Movie</h3>
            <div className="movie-trim-control">
              <span>Trim</span>
              <div className="movie-trim-track">
                <input
                  aria-label="Selected video trim start"
                  className="ew-range-input"
                  max={trimSliderMax}
                  min="0"
                  step="0.1"
                  type="range"
                value={videoElement.trimStartSeconds}
                  onChange={(event) => {
                    const nextStart = Math.min(toTrimSeconds(event.target.value), trimEndSeconds);
                    onUpdateMedia({ trimStartSeconds: nextStart });
                  }}
                />
                <input
                  aria-label="Selected video trim end"
                  className="ew-range-input"
                  max={trimSliderMax}
                  min="0"
                  step="0.1"
                  type="range"
                  value={trimEndSeconds}
                  onChange={(event) => {
                    const nextEnd = Math.max(
                      toTrimSeconds(event.target.value),
                      videoElement.trimStartSeconds,
                    );
                    onUpdateMedia({ trimEndSeconds: nextEnd });
                  }}
                />
              </div>
              <div className="movie-time-row">
                <span>{formatMovieTime(videoElement.trimStartSeconds)}</span>
                <span>{formatMovieTime(trimEndSeconds)}</span>
              </div>
            </div>

            <label className="movie-poster-control">
              <span>Poster Frame</span>
              <input
                aria-label="Selected video poster frame"
                className="ew-range-input"
                max={trimSliderMax}
                min="0"
                step="0.1"
                type="range"
                value={videoElement.posterFrameSeconds ?? videoElement.trimStartSeconds}
                onChange={(event) => {
                  onUpdateMedia({ posterFrameSeconds: toTrimSeconds(event.target.value) });
                }}
              />
              <strong>
                {formatMovieTime(videoElement.posterFrameSeconds ?? videoElement.trimStartSeconds)}
              </strong>
            </label>
          </section>

          <section className="movie-panel-section" aria-label="Movie repeat">
            <label className="movie-select-control">
              <span>Repeat</span>
              <select
                aria-label="Selected video repeat mode"
                value={repeatMode}
                onChange={(event) => {
                  const nextRepeatMode = event.target.value as VideoRepeatMode;
                  onUpdateMedia({ loop: nextRepeatMode === 'loop', repeatMode: nextRepeatMode });
                }}
              >
                {videoRepeatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="movie-select-control">
              <span>Start</span>
              <select
                aria-label="Selected video start"
                value={movieStart}
                onChange={(event) => {
                  setMovieStart(toMovieStartTrigger(event.target.value));
                }}
              >
                <option value="on-click">On click</option>
                <option value="after-transition">After transition</option>
                <option value="after-previous">After previous build</option>
              </select>
            </label>
            <label className="movie-checkbox-row">
              <input
                aria-label="Play movie across slides"
                type="checkbox"
                checked={Boolean(videoElement.playAcrossSlides)}
                onChange={(event) => onUpdateMedia({ playAcrossSlides: event.target.checked })}
              />
              <span>Play movie across slides</span>
            </label>
          </section>
            </>
          ) : null}
          {element.type === 'text' ? (
            <section className="movie-panel-section" aria-label="Selected text content controls">
              <h3>Content</h3>
              <label className="design-control design-control-stacked ew-field-scope">
                <span>Text</span>
                <textarea
                  aria-label="Selected text content"
                  value={element.text}
                  onChange={(event) => {
                    onTextContentChange?.(event.target.value);
                  }}
                />
              </label>
            </section>
          ) : null}
          {element.type === 'gif' ? (
            <section className="movie-panel-section" aria-label="GIF movie controls">
              <h3>Movie</h3>
              <div className="movie-file-row">
                <Film size={18} aria-hidden="true" />
                <span className="ew-ellipsis">{assetName ?? 'Animated GIF'}</span>
              </div>
              <label className="movie-checkbox-row">
                <input
                  aria-label="Play selected GIF"
                  type="checkbox"
                  checked={element.playing}
                  onChange={(event) => onUpdateMedia({ playing: event.target.checked })}
                />
                <span>Play GIF</span>
              </label>
            </section>
          ) : null}

          {element.type === 'image' ? (
            <section className="movie-panel-section" aria-label="Selected image controls">
              <h3>Image</h3>
              <div className="movie-file-row">
                <Image size={18} aria-hidden="true" />
                <span className="ew-ellipsis">{assetName ?? 'Imported image'}</span>
              </div>
            </section>
          ) : null}

        </>
      ) : null}

      {activeTab === 'arrange' ? (
        <>
          <section className="movie-panel-section" aria-label="Arrange selected element order">
            <div className="movie-arrange-grid ew-two-column-grid">
              <button type="button" onClick={() => onZOrderChange?.('back')}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  flip_to_back
                </span>
                Back
              </button>
              <button type="button" onClick={() => onZOrderChange?.('front')}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  flip_to_front
                </span>
                Front
              </button>
              <button type="button" onClick={() => onZOrderChange?.('backward')}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  keyboard_arrow_down
                </span>
                Backward
              </button>
              <button type="button" onClick={() => onZOrderChange?.('forward')}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  keyboard_arrow_up
                </span>
                Forward
              </button>
            </div>
            <div className="movie-arrange-select-row ew-field-scope ew-two-column-grid">
              <select
                aria-label="Align selected element"
                defaultValue=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  onAlign?.(event.target.value as AlignMode);
                  event.target.value = '';
                }}
              >
                <option value="" disabled>
                  Align
                </option>
                <option value="horizontal-center">Horizontal center</option>
                <option value="vertical-center">Vertical center</option>
                <option value="page-center">Page center</option>
              </select>
              <button type="button" disabled>
                Distribute
              </button>
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Selected element size">
            <h3>Size</h3>
            <div className="movie-number-grid ew-field-scope ew-two-column-grid">
              <label>
                <input
                  aria-label="Selected element width"
                  min="1"
                  type="number"
                  value={Math.round(element.width)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      width: getBoundedNumber(event.target.value, element.width, 1),
                    })
                  }
                />
                <span>Width</span>
              </label>
              <label>
                <input
                  aria-label="Selected element height"
                  min="1"
                  type="number"
                  value={Math.round(element.height)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      height: getBoundedNumber(event.target.value, element.height, 1),
                    })
                  }
                />
                <span>Height</span>
              </label>
            </div>
            <label className="movie-checkbox-row">
              <input type="checkbox" checked readOnly />
              <span>Constrain proportions</span>
            </label>
            <button className="movie-full-button" type="button" disabled>
              Original Size
            </button>
          </section>

          <section className="movie-panel-section" aria-label="Selected element position">
            <h3>Position</h3>
            <div className="movie-number-grid ew-field-scope ew-two-column-grid">
              <label>
                <input
                  aria-label="Selected element x position"
                  type="number"
                  value={Math.round(element.x)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      x: getBoundedNumber(event.target.value, element.x),
                    })
                  }
                />
                <span>X</span>
              </label>
              <label>
                <input
                  aria-label="Selected element y position"
                  type="number"
                  value={Math.round(element.y)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      y: getBoundedNumber(event.target.value, element.y),
                    })
                  }
                />
                <span>Y</span>
              </label>
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Selected element rotation">
            <h3>Rotate</h3>
            <div className="movie-number-grid ew-field-scope ew-two-column-grid">
              <label>
                <input
                  aria-label="Selected element rotation"
                  type="number"
                  value={Math.round(element.rotation)}
                  onChange={(event) =>
                    onFrameUpdate?.({
                      rotation: getBoundedNumber(event.target.value, element.rotation, -360),
                    })
                  }
                />
                <span>Angle</span>
              </label>
              <button className="movie-full-button" type="button" disabled>
                Flip
              </button>
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Selected element lock and grouping">
            <div className="movie-lock-grid ew-two-column-grid">
              <button type="button" disabled={locked} onClick={() => onLockChange?.(true)}>
                Lock
              </button>
              <button type="button" disabled={!locked} onClick={() => onLockChange?.(false)}>
                Unlock
              </button>
              <button type="button" disabled>
                Group
              </button>
              <button type="button" disabled>
                Ungroup
              </button>
            </div>
          </section>
        </>
      ) : null}
    </PanelSection>
  );
}
