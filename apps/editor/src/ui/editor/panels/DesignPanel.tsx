import { CaseSensitive } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DesignElement,
  ElementAnimationBuild,
  PageBackground,
  ProjectDocument,
  SelectionState,
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
import { ElementDesignInspector } from './ElementDesignInspector';
import { PresentationDesignPanel } from './PresentationDesignPanel';
import { SlideDesignPanel } from './SlideDesignPanel';

type ElementAnimationPatch = Omit<ElementAnimationBuild, 'elementId' | 'id'>;

const palette = ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'];

interface DesignPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  availableFonts?: FontCatalogItem[];
  localFonts?: FontCatalogItem[];
  focusFontControlKey?: number | undefined;
  onDownloadFont?: (family: string) => Promise<void>;
  onImportLocalFont?: (family: string) => Promise<void>;
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
  localFonts = [],
  focusFontControlKey,
  onDownloadFont,
  onImportLocalFont,
  onReplaceVideoAsset,
  onSetElementAnimationBuilds,
}: DesignPanelProps) {
  const fontSelectRef = useRef<HTMLButtonElement>(null);
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
  const localFontFamilyOptions = useMemo(() => {
    const existingFamilies = new Set(fontFamilyOptions.map((font) => font.toLowerCase()));
    return localFonts
      .map((font) => font.family)
      .filter((family) => !existingFamilies.has(family.toLowerCase()))
      .sort((left, right) => left.localeCompare(right));
  }, [fontFamilyOptions, localFonts]);
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
      setFontDownloadOpen(false);
    } catch (error) {
      setFontDownloadStatus(error instanceof Error ? error.message : 'Font download failed.');
    } finally {
      setDownloadingFontFamily(undefined);
    }
  }

  async function applyFontFamily(family: string) {
    if (!family) return;
    const isLocalFont = localFontFamilyOptions.some((localFamily) => localFamily === family);
    if (isLocalFont && onImportLocalFont) {
      setDownloadingFontFamily(family);
      setFontDownloadStatus(`Adding ${family} from local fonts...`);
      try {
        await onImportLocalFont(family);
        setFontDownloadStatus(`${family} added to mirrored fonts`);
        setFontDownloadOpen(false);
      } catch (error) {
        setFontDownloadStatus(error instanceof Error ? error.message : 'Local font import failed.');
      } finally {
        setDownloadingFontFamily(undefined);
      }
      return;
    }
    updateSelectedStyle({ fontFamily: family });
    setFontDownloadOpen(false);
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
                  localFontFamilyOptions,
                  fontSearchInput,
                  fontSearchQuery,
                  fontSelectRef,
                  hasFontDownload: Boolean(onDownloadFont),
                  onApplyFontFamily: applyFontFamily,
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
