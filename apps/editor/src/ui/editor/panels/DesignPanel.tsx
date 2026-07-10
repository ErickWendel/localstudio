import {
  CaseSensitive,
  ChevronDown,
  Film,
  Image,
  Square,
  Type,
  Video,
} from 'lucide-react';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DesignElement,
  ElementAnimationBuild,
  PageBackground,
  PresentationTheme,
  ProjectDocument,
  SelectionState,
  SlideLayout,
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
import { DesignColorField } from './design-controls/DesignColorField';
import { DesignSelectField } from './design-controls/DesignSelectField';
import { MovieInspector } from './movie-inspector/MovieInspector';
import { ShapeStyleInspector } from './shape-style/ShapeStyleInspector';
import { TextStyleInspector } from './text-style/TextStyleInspector';
import type { TextStyleControls } from './text-style/TextStyleInspector';

type ElementAnimationPatch = Omit<ElementAnimationBuild, 'elementId' | 'id'>;

const palette = ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'];
const defaultPresentationTheme: PresentationTheme = {
  id: 'theme-default',
  name: 'Default theme',
  palette: {
    accent: '#37FD76',
    background: '#050D10',
    mutedText: '#91999D',
    surface: '#0C1417',
    text: '#FFFFFF',
  },
  typography: {
    bodyFontFamily: 'Open Sans',
    headingFontFamily: 'Orbitron',
  },
};
const slideFillTypeOptions = [{ value: 'color', label: 'Color fill' }] as const;

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
  onApplyTheme?: (themeId: string) => void;
  onEditTheme?: (themeId: string) => void;
  onChangeTheme?: () => void;
  onApplySlideLayout?: (pageId: string, layoutId: string) => void;
  onEditSlideLayout?: (layoutId: string) => void;
  onToggleSlideLayoutPlaceholder?: (
    layoutId: string,
    role: 'body' | 'footer' | 'slideNumber' | 'title',
    visible: boolean,
  ) => void;
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

function getThemeOptions(project: ProjectDocument) {
  const importedThemes = Object.values(project.themes ?? {}).filter(
    (theme) => theme.id !== defaultPresentationTheme.id && theme.palette && theme.typography,
  );
  return [defaultPresentationTheme, ...importedThemes];
}

function getSlideLayoutOptions(project: ProjectDocument) {
  return Object.values(project.slideLayouts ?? {});
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
  onApplyTheme,
  onEditTheme,
  onChangeTheme,
  onApplySlideLayout,
  onEditSlideLayout,
  onToggleSlideLayoutPlaceholder,
  onAlignSelectedElement,
  onSetElementLock,
  onSetSelectedElementZOrder,
  availableFonts = [],
  focusFontControlKey,
  onDownloadFont,
  onReplaceVideoAsset,
  onSetElementAnimationBuilds,
}: DesignPanelProps) {
  const fontSelectRef = useRef<HTMLSelectElement>(null);
  const [fontDownloadOpen, setFontDownloadOpen] = useState(false);
  const [fontSearchInput, setFontSearchInput] = useState('');
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [downloadingFontFamily, setDownloadingFontFamily] = useState<string | undefined>();
  const [fontDownloadStatus, setFontDownloadStatus] = useState<string | undefined>();
  const page = project.pages.find((item) => item.id === activePageId);
  const selectedElement = getSelectedElement(project, selection);
  const selectionTarget = selection.target ?? (selectedElement ? 'elements' : 'presentation');
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

  function applyColor(color: string) {
    if (selectedElement?.type === 'text' || selectedElement?.type === 'shape') {
      updateSelectedStyle({ fill: color });
      return;
    }
    onUpdatePageBackground?.({ type: 'color', color });
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

  if (selectionTarget === 'presentation') {
    return (
      <PresentationDesignPanel
        project={project}
        page={page}
        onApplyTheme={onApplyTheme}
        onChangeTheme={onChangeTheme}
        onEditTheme={onEditTheme}
      />
    );
  }

  if (selectionTarget === 'slide') {
    return (
      <SlideDesignPanel
        page={page}
        project={project}
        onApplySlideLayout={onApplySlideLayout}
        onEditSlideLayout={onEditSlideLayout}
        onToggleSlideLayoutPlaceholder={onToggleSlideLayoutPlaceholder}
        onUpdatePageBackground={onUpdatePageBackground}
      />
    );
  }

  return (
    <div className="panel-stack">
      <PanelSection title="Canvas">
        <div className="property-row ew-surface ew-surface-hover ew-compact-row">
          <span>Format</span>
          <strong>{page ? `${page.width} x ${page.height}` : 'No page'}</strong>
        </div>
        <DesignColorField
          ariaLabel="Canvas background color"
          label="Background"
          value={backgroundColor}
          onChange={(color) => {
            onUpdatePageBackground?.({ type: 'color', color });
          }}
        />
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

      {selectedElement ? (
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
      ) : (
        <PanelSection title="Selection">
          <div className="compact-action design-selection-summary ew-surface ew-surface-hover ew-compact-row">
            <CaseSensitive size={16} />
            <span>No selected element</span>
          </div>
        </PanelSection>
      )}
    </div>
  );
}

interface PresentationDesignPanelProps {
  page?: ProjectDocument['pages'][number] | undefined;
  project: ProjectDocument;
  onApplyTheme: ((themeId: string) => void) | undefined;
  onChangeTheme: (() => void) | undefined;
  onEditTheme: ((themeId: string) => void) | undefined;
}

function PresentationDesignPanel({
  page,
  project,
  onApplyTheme,
  onChangeTheme,
  onEditTheme,
}: PresentationDesignPanelProps) {
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const themeOptions = getThemeOptions(project);
  const theme =
    themeOptions.find((item) => item.id === project.themeId) ??
    (project.themeId ? project.themes?.[project.themeId] : undefined) ??
    defaultPresentationTheme;
  const themeId = theme.id;
  const themeName = theme?.name ?? 'Custom theme';
  return (
    <div className="panel-stack">
      <PanelSection title="Presentation">
        <button
          aria-expanded={themePickerOpen}
          aria-label={`Open theme picker, current theme ${themeName}`}
          className="template-preview-card template-preview-button"
          type="button"
          onClick={() => setThemePickerOpen((current) => !current)}
        >
          <div className="template-filmstrip" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="template-preview-copy">
            <span>Theme</span>
            <strong>{themeName}</strong>
          </div>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {themePickerOpen ? (
          <ThemeChooser
            activeThemeId={themeId}
            themes={themeOptions}
            onApplyTheme={(nextThemeId) => {
              onApplyTheme?.(nextThemeId);
              setThemePickerOpen(false);
            }}
          />
        ) : null}
        <div className="template-action-row">
          <button type="button" onClick={onChangeTheme}>
            Change theme
          </button>
          <button type="button" disabled={!themeId} onClick={() => themeId && onEditTheme?.(themeId)}>
            Edit theme
          </button>
          <button type="button" disabled={!themeId} onClick={() => themeId && onApplyTheme?.(themeId)}>
            Apply theme
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Slideshow Settings">
        <label className="template-checkbox-row">
          <input type="checkbox" />
          <span>Automatically play upon open</span>
        </label>
        <label className="template-checkbox-row">
          <input type="checkbox" />
          <span>Loop slideshow</span>
        </label>
        <label className="template-checkbox-row">
          <input type="checkbox" />
          <span>Restart show if idle for</span>
        </label>
      </PanelSection>

      <PanelSection title="Presentation Type">
        <label className="design-control ew-field-scope">
          <span>Type</span>
          <select aria-label="Presentation type" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="kiosk">Kiosk</option>
            <option value="self-running">Self-running</option>
          </select>
        </label>
        <div className="property-row ew-surface ew-surface-hover ew-compact-row">
          <span>Slide size</span>
          <strong>{page ? `${page.width} x ${page.height}` : 'No slide'}</strong>
        </div>
      </PanelSection>
    </div>
  );
}

interface SlideDesignPanelProps {
  page?: ProjectDocument['pages'][number] | undefined;
  project: ProjectDocument;
  onApplySlideLayout: ((pageId: string, layoutId: string) => void) | undefined;
  onEditSlideLayout: ((layoutId: string) => void) | undefined;
  onToggleSlideLayoutPlaceholder:
    | ((
        layoutId: string,
        role: 'body' | 'footer' | 'slideNumber' | 'title',
        visible: boolean,
      ) => void)
    | undefined;
  onUpdatePageBackground: ((background: PageBackground) => void) | undefined;
}

function SlideDesignPanel({
  page,
  project,
  onApplySlideLayout,
  onEditSlideLayout,
  onToggleSlideLayoutPlaceholder,
  onUpdatePageBackground,
}: SlideDesignPanelProps) {
  const layout = page?.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
  const layoutOptions = getSlideLayoutOptions(project);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const layoutId = layout?.id ?? layoutOptions[0]?.id;
  const layoutName = layout?.name ?? 'Blank';
  const backgroundColor = page ? getBackgroundColor(page.background) : '#050D10';
  const visibility = layout?.placeholderVisibility ?? {
    body: true,
    footer: true,
    slideNumber: true,
    title: true,
  };
  return (
    <div className="panel-stack">
      <PanelSection title="Slide">
        <button
          aria-expanded={layoutPickerOpen}
          aria-label={`Open layout picker, current layout ${layoutName}`}
          className="template-preview-card template-preview-card-slide template-preview-button"
          type="button"
          onClick={() => setLayoutPickerOpen((current) => !current)}
        >
          <div className="template-slide-thumbnail" aria-hidden="true">
            <span className="template-slide-title" />
            <span className="template-slide-body" />
            <span className="template-slide-footer" />
          </div>
          <div className="template-preview-copy">
            <span>Slide layout</span>
            <strong>{layoutName}</strong>
          </div>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {layoutPickerOpen ? (
          <SlideLayoutChooser
            activeLayoutId={layout?.id}
            layouts={layoutOptions}
            pageId={page?.id}
            onApplySlideLayout={(pageId, nextLayoutId) => {
              onApplySlideLayout?.(pageId, nextLayoutId);
              setLayoutPickerOpen(false);
            }}
          />
        ) : null}
        <div className="template-action-row">
          <button type="button" disabled={!layoutId} onClick={() => layoutId && onEditSlideLayout?.(layoutId)}>
            Edit layout
          </button>
          <button
            type="button"
            disabled={!layoutId || !page}
            onClick={() => page && layoutId && onApplySlideLayout?.(page.id, layoutId)}
          >
            Apply layout
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Appearance">
        {(
          [
            ['title', 'Title'],
            ['body', 'Body'],
            ['footer', 'Footer'],
            ['slideNumber', 'Slide number'],
          ] as const
        ).map(([role, label]) => (
          <label className="template-checkbox-row" key={role}>
            <input
              checked={visibility[role]}
              disabled={!layoutId}
              type="checkbox"
              onChange={(event) => {
                if (layoutId) onToggleSlideLayoutPlaceholder?.(layoutId, role, event.target.checked);
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </PanelSection>

      <PanelSection title="Background">
        <div className="template-segmented-control" role="group" aria-label="Background mode">
          <button className="template-segmented-active" type="button">
            Standard
          </button>
          <button type="button">Dynamic</button>
        </div>
        <DesignColorField
          ariaLabel="Slide background color"
          label="Current fill"
          value={backgroundColor}
          onChange={(color) => {
            onUpdatePageBackground?.({ type: 'color', color });
          }}
        />
        <DesignSelectField
          ariaLabel="Slide fill type"
          defaultValue="color"
          label="Fill type"
          options={slideFillTypeOptions}
        />
      </PanelSection>
    </div>
  );
}

interface ThemeChooserProps {
  activeThemeId: string;
  themes: PresentationTheme[];
  onApplyTheme: (themeId: string) => void;
}

function ThemeChooser({ activeThemeId, themes, onApplyTheme }: ThemeChooserProps) {
  return (
    <div className="template-chooser-shelf" aria-label="Choose a theme" role="region">
      <div className="template-chooser-title">Choose a theme</div>
      <div className="theme-choice-list">
        {themes.map((theme) => (
          <button
            aria-current={theme.id === activeThemeId ? 'true' : undefined}
            className={
              theme.id === activeThemeId
                ? 'theme-choice-card theme-choice-card-active'
                : 'theme-choice-card'
            }
            key={theme.id}
            type="button"
            onClick={() => onApplyTheme(theme.id)}
          >
            <span
              className="theme-choice-preview"
              style={
                {
                  '--theme-choice-accent': theme.palette.accent,
                  '--theme-choice-background': theme.palette.background,
                  '--theme-choice-surface': theme.palette.surface,
                  '--theme-choice-text': theme.palette.text,
                } as CSSProperties
              }
            >
              <span />
              <span />
              <span />
            </span>
            <span className="theme-choice-copy">
              <strong>{theme.name}</strong>
              <span>
                {theme.typography.headingFontFamily} / {theme.typography.bodyFontFamily}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface SlideLayoutChooserProps {
  activeLayoutId?: string | undefined;
  layouts: SlideLayout[];
  pageId?: string | undefined;
  onApplySlideLayout: (pageId: string, layoutId: string) => void;
}

function SlideLayoutChooser({
  activeLayoutId,
  layouts,
  pageId,
  onApplySlideLayout,
}: SlideLayoutChooserProps) {
  return (
    <div className="template-chooser-shelf" aria-label="Choose a layout" role="region">
      <div className="template-chooser-title">Choose a layout</div>
      {layouts.length > 0 ? (
        <div className="layout-choice-grid">
          {layouts.map((layout) => (
            <button
              aria-current={layout.id === activeLayoutId ? 'true' : undefined}
              className={
                layout.id === activeLayoutId
                  ? 'layout-choice-card layout-choice-card-active'
                  : 'layout-choice-card'
              }
              disabled={!pageId}
              key={layout.id}
              type="button"
              onClick={() => {
                if (pageId) onApplySlideLayout(pageId, layout.id);
              }}
            >
              <LayoutChoiceThumbnail layout={layout} />
              <span>{layout.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="template-chooser-empty">No imported layouts yet.</p>
      )}
    </div>
  );
}

function LayoutChoiceThumbnail({ layout }: { layout: SlideLayout }) {
  const elements = layout.elementIds
    .map((elementId) => layout.elements[elementId])
    .filter((element): element is DesignElement => Boolean(element))
    .filter((element) => element.visible !== false);
  if (elements.length > 0) {
    const bounds = getLayoutThumbnailBounds(elements);
    return (
      <span
        className="layout-choice-thumbnail"
        aria-hidden="true"
        style={getLayoutThumbnailStyle(layout)}
      >
        {elements.map((element) => (
          <LayoutChoiceElement element={element} key={element.id} bounds={bounds} />
        ))}
      </span>
    );
  }
  const roles = new Set(layout.placeholderRoles);
  return (
    <span
      className="layout-choice-thumbnail"
      aria-hidden="true"
      style={getLayoutThumbnailStyle(layout)}
    >
      {roles.has('title') ? <span className="layout-choice-title" /> : null}
      {roles.has('body') ? <span className="layout-choice-body" /> : null}
      {roles.has('footer') ? <span className="layout-choice-footer" /> : null}
      {roles.has('slideNumber') ? <span className="layout-choice-number" /> : null}
      {roles.size === 0 ? <span className="layout-choice-blank" /> : null}
    </span>
  );
}

function getLayoutPreviewInk(backgroundColor: string) {
  const normalized = backgroundColor.replace('#', '');
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized;
  const red = Number.parseInt(fullHex.slice(0, 2), 16);
  const green = Number.parseInt(fullHex.slice(2, 4), 16);
  const blue = Number.parseInt(fullHex.slice(4, 6), 16);
  if (![red, green, blue].every(Number.isFinite)) return '#182124';
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? '#1E2528' : '#F5F7F3';
}

function getLayoutThumbnailStyle(layout: SlideLayout): CSSProperties {
  const background = layout.background.type === 'color' ? layout.background.color : '#F8FAF7';
  return {
    '--layout-preview-background': background,
    '--layout-preview-ink': getLayoutPreviewInk(background),
  } as CSSProperties;
}

function getLayoutThumbnailBounds(elements: DesignElement[]) {
  const xValues = elements.flatMap((element) => [element.x, element.x + element.width]);
  const yValues = elements.flatMap((element) => [element.y, element.y + element.height]);
  const minX = Math.min(...xValues, 0);
  const minY = Math.min(...yValues, 0);
  const maxX = Math.max(...xValues, 1920);
  const maxY = Math.max(...yValues, 1080);
  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function getLayoutElementStyle(
  element: DesignElement,
  bounds: ReturnType<typeof getLayoutThumbnailBounds>,
): CSSProperties {
  return {
    left: `${((element.x - bounds.minX) / bounds.width) * 100}%`,
    top: `${((element.y - bounds.minY) / bounds.height) * 100}%`,
    width: `${(element.width / bounds.width) * 100}%`,
    height: `${(element.height / bounds.height) * 100}%`,
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
  };
}

function LayoutChoiceElement({
  bounds,
  element,
}: {
  bounds: ReturnType<typeof getLayoutThumbnailBounds>;
  element: DesignElement;
}) {
  const style = getLayoutElementStyle(element, bounds);
  if (element.type === 'text') {
    const roleClass = element.placeholderRole
      ? ` layout-choice-placeholder layout-choice-placeholder-${element.placeholderRole}`
      : ' layout-choice-text-run';
    return (
      <span
        className={`layout-choice-element layout-choice-text${roleClass}`}
        style={{
          ...style,
          justifyContent:
            element.align === 'center' ? 'center' : element.align === 'right' ? 'flex-end' : 'flex-start',
        }}
      />
    );
  }
  if (element.type === 'shape') {
    return (
      <span
        className={`layout-choice-element layout-choice-shape layout-choice-shape-${element.shape}`}
        style={{
          ...style,
          background: element.fill ?? 'transparent',
          borderColor: element.stroke ?? element.fill ?? '#050D10',
          borderWidth: element.strokeWidth ? 1 : 0,
        }}
      />
    );
  }
  return <span className="layout-choice-element layout-choice-media" style={style} />;
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
  const contentLabel = getElementContentTabLabel(element);
  const locked = element.locked;
  const videoElement = element.type === 'video' ? element : undefined;

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
            <ShapeStyleInspector element={element} onUpdateStyle={onUpdateStyle} />
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
            <MovieInspector
              assetName={assetName}
              element={videoElement}
              onReplaceVideoAsset={onReplaceVideoAsset}
              onSetElementAnimationBuilds={onSetElementAnimationBuilds}
              onUpdateMedia={onUpdateMedia}
              page={page}
            />
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
