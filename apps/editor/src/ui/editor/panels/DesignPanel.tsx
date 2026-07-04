import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  CaseSensitive,
  Download,
  Film,
  Image,
  Plus,
  Search,
  Square,
  Type,
  Video,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  DesignElement,
  PageBackground,
  ProjectDocument,
  SelectionState,
  ShapeElement,
  ShapeLineEndpoint,
  VideoElement,
} from '../../../domain/documents/model';
import type {
  ElementStylePatch,
  MediaPlaybackPatch,
} from '../../../domain/commands/elements/basicCommands';
import type { FontCatalogItem } from '../../../services/contracts/interfaces';
import { PanelSection } from '../../components/PanelSection';
import { textStyleOptions } from '../text/textStyleOptions';

const palette = ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'];
const regularTextWeight = 400;
const boldTextWeight = 800;
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

interface DesignPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  availableFonts?: FontCatalogItem[];
  focusFontControlKey?: number | undefined;
  onDownloadFont?: (family: string) => Promise<void>;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
  onUpdateMediaPlayback?: (elementId: string, patch: MediaPlaybackPatch) => void;
  onUpdatePageBackground?: (background: PageBackground) => void;
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

export function DesignPanel({
  project,
  activePageId,
  selection,
  onUpdateElementStyle,
  onUpdateMediaPlayback,
  onUpdatePageBackground,
  availableFonts = [],
  focusFontControlKey,
  onDownloadFont,
}: DesignPanelProps) {
  const fontSelectRef = useRef<HTMLSelectElement>(null);
  const [fontDownloadOpen, setFontDownloadOpen] = useState(false);
  const [fontSearchInput, setFontSearchInput] = useState('');
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [downloadingFontFamily, setDownloadingFontFamily] = useState<string | undefined>();
  const [fontDownloadStatus, setFontDownloadStatus] = useState<string | undefined>();
  const page = project.pages.find((item) => item.id === activePageId);
  const selectedElement = getSelectedElement(project, selection);
  const backgroundColor = page ? getBackgroundColor(page.background) : '#050D10';
  const projectFontFamilies = useMemo(
    () => Array.from(new Set(Object.values(project.fonts ?? {}).map((font) => font.family))).sort(),
    [project.fonts],
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
  const selectedTextIsBold =
    selectedElement?.type === 'text' && selectedElement.fontWeight >= boldTextWeight;

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

  return (
    <div className="panel-stack">
      <PanelSection title="Canvas">
        <div className="property-row">
          <span>Format</span>
          <strong>{page ? `${page.width} x ${page.height}` : 'No page'}</strong>
        </div>
        <label className="design-control">
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

      {selectedElement?.type === 'text' ? (
        <PanelSection title="Font">
          <div className="text-inspector-stack">
            <div className="font-control-row">
              <label className="text-inspector-field text-inspector-field-full">
                <span className="text-inspector-label">Font</span>
                <select
                  aria-label="Selected text font"
                  ref={fontSelectRef}
                  value={selectedElement.fontFamily}
                  onChange={(event) => {
                    updateSelectedStyle({ fontFamily: event.target.value });
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
                onClick={() => {
                  setFontDownloadOpen((current) => !current);
                }}
              >
                <Plus size={16} />
              </button>
            </div>
            {fontDownloadOpen ? (
              <div className="font-download-panel">
                <form className="font-download-search" onSubmit={submitFontSearch}>
                  <label className="layer-search font-download-search-box">
                    <Search size={16} aria-hidden="true" />
                    <input
                      aria-label="Search downloadable fonts"
                      placeholder="Search Google Fonts"
                      type="search"
                      value={fontSearchInput}
                      onChange={(event) => {
                        const nextSearch = event.target.value;
                        setFontSearchInput(nextSearch);
                        setFontSearchQuery(nextSearch.trim());
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
                          disabled={!onDownloadFont || downloadingFontFamily === font.family}
                          key={font.family}
                          type="button"
                          onClick={() => {
                            void downloadFont(font.family);
                          }}
                        >
                          <span>{font.family}</span>
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
              <label className="text-inspector-field">
                <span className="text-inspector-label">Weight</span>
              <select
                aria-label="Selected text font weight"
                value={selectedElement.fontWeight}
                onChange={(event) => {
                  updateSelectedStyle({ fontWeight: Number(event.target.value) });
                }}
              >
                {textStyleOptions.TEXT_FONT_WEIGHTS.map((fontWeight) => (
                  <option key={fontWeight} value={fontWeight}>
                    {fontWeight}
                  </option>
                ))}
              </select>
              </label>
              <label className="text-inspector-field">
                <span className="text-inspector-label">Size</span>
                <input
                  aria-label="Selected text font size"
                  min="1"
                  type="number"
                  value={selectedElement.fontSize}
                  onChange={(event) => {
                    updateSelectedStyle({ fontSize: Number(event.target.value) });
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
                  updateSelectedStyle({
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
                value={selectedElement.fill}
                onChange={(event) => {
                  updateSelectedStyle({ fill: event.target.value });
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
                    aria-pressed={selectedElement.align === item.align}
                    className={
                      selectedElement.align === item.align
                        ? 'text-align-button active'
                        : 'text-align-button'
                    }
                    key={item.align}
                    type="button"
                    onClick={() => {
                      updateSelectedStyle({ align: item.align });
                    }}
                  >
                    <Icon size={18} />
                  </button>
                );
              })}
            </div>
          </div>
        </PanelSection>
      ) : null}

      <PanelSection title="Selection">
        <div className="compact-action design-selection-summary">
          {selectedElement?.type === 'text' ? <Type size={16} /> : null}
          {selectedElement?.type === 'image' ? <Image size={16} /> : null}
          {selectedElement?.type === 'gif' ? <Film size={16} /> : null}
          {selectedElement?.type === 'video' ? <Video size={16} /> : null}
          {selectedElement?.type === 'shape' ? <Square size={16} /> : null}
          {!selectedElement ? <CaseSensitive size={16} /> : null}
          <span>
            {selectedElement ? `Selected ${selectedElement.type}` : 'No selected element'}
          </span>
        </div>
        {selectedElement ? (
          <label className="design-control">
            <span>Opacity</span>
            <input
              aria-label="Selected element opacity"
              max="100"
              min="0"
              type="range"
              value={Math.round(selectedElement.opacity * 100)}
              onChange={(event) => {
                updateSelectedStyle({ opacity: Number(event.target.value) / 100 });
              }}
            />
          </label>
        ) : null}
      </PanelSection>

      {selectedElement?.type === 'video' ? (
        <VideoPlaybackPanel element={selectedElement} onUpdate={updateSelectedMediaPlayback} />
      ) : null}

      {selectedElement?.type === 'shape' ? (
        <PanelSection title="Shape">
          <label className="design-control">
            <span>Fill</span>
            <select
              aria-label="Selected shape fill mode"
              value={selectedElement.fill ? 'color' : 'none'}
              onChange={(event) => {
                updateSelectedStyle({
                  fill: event.target.value === 'color' ? (selectedElement.fill ?? '#37FD76') : null,
                });
              }}
            >
              <option value="none">No fill</option>
              <option value="color">Color fill</option>
            </select>
          </label>
          {selectedElement.fill ? (
            <label className="design-control">
              <span>Fill color</span>
              <input
                aria-label="Selected shape fill color"
                type="color"
                value={selectedElement.fill}
                onChange={(event) => {
                  updateSelectedStyle({ fill: event.target.value });
                }}
              />
            </label>
          ) : null}
          <label className="design-control">
            <span>Border</span>
            <select
              aria-label="Selected shape border mode"
              value={
                selectedElement.stroke && (selectedElement.strokeWidth ?? 0) > 0 ? 'color' : 'none'
              }
              onChange={(event) => {
                updateSelectedStyle(
                  event.target.value === 'color'
                    ? {
                        stroke: selectedElement.stroke ?? '#37FD76',
                        strokeWidth:
                          selectedElement.strokeWidth && selectedElement.strokeWidth > 0
                            ? selectedElement.strokeWidth
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
          {selectedElement.stroke && (selectedElement.strokeWidth ?? 0) > 0 ? (
            <>
              <label className="design-control">
                <span>Border color</span>
                <input
                  aria-label="Selected shape border color"
                  type="color"
                  value={selectedElement.stroke}
                  onChange={(event) => {
                    updateSelectedStyle({ stroke: event.target.value });
                  }}
                />
              </label>
              <label className="design-control">
                <span>Border width</span>
                <input
                  aria-label="Selected shape border width"
                  min="1"
                  type="number"
                  value={selectedElement.strokeWidth ?? 2}
                  onChange={(event) => {
                    updateSelectedStyle({ strokeWidth: Number(event.target.value) });
                  }}
                />
              </label>
              {supportsLineEndpoints(selectedElement) ? (
                <>
                  <label className="design-control">
                    <span>Start endpoint</span>
                    <select
                      aria-label="Selected shape start endpoint"
                      value={selectedElement.startEndpoint ?? 'none'}
                      onChange={(event) => {
                        updateSelectedStyle({
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
                  <label className="design-control">
                    <span>End endpoint</span>
                    <select
                      aria-label="Selected shape end endpoint"
                      value={
                        selectedElement.endEndpoint ??
                        (selectedElement.shape === 'arrow' ? 'arrow' : 'none')
                      }
                      onChange={(event) => {
                        updateSelectedStyle({
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
        </PanelSection>
      ) : null}
    </div>
  );
}

interface VideoPlaybackPanelProps {
  element: VideoElement;
  onUpdate: (patch: MediaPlaybackPatch) => void;
}

function toTrimSeconds(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getTrimSliderMax(element: VideoElement) {
  return Math.max(60, Math.ceil(element.trimStartSeconds), Math.ceil(element.trimEndSeconds ?? 0));
}

function VideoPlaybackPanel({ element, onUpdate }: VideoPlaybackPanelProps) {
  const trimSliderMax = getTrimSliderMax(element);

  return (
    <PanelSection title="Playback">
      <label className="design-control">
        <span>Loop</span>
        <input
          aria-label="Loop selected video"
          type="checkbox"
          checked={element.loop}
          onChange={(event) => {
            onUpdate({ loop: event.target.checked });
          }}
        />
      </label>
      <label className="design-control">
        <span>Controls</span>
        <input
          aria-label="Show selected video controls"
          type="checkbox"
          checked={element.controls}
          onChange={(event) => {
            onUpdate({ controls: event.target.checked });
          }}
        />
      </label>
      <label className="design-control">
        <span>Muted</span>
        <input
          aria-label="Mute selected video"
          type="checkbox"
          checked={element.muted}
          onChange={(event) => {
            onUpdate({ muted: event.target.checked });
          }}
        />
      </label>
      <label className="design-control">
        <span>Preview autoplay</span>
        <input
          aria-label="Autoplay selected video in preview"
          type="checkbox"
          checked={element.autoplayInPreview}
          onChange={(event) => {
            onUpdate({ autoplayInPreview: event.target.checked });
          }}
        />
      </label>
      <label className="design-control">
        <span>Trim start {element.trimStartSeconds.toFixed(1)}s</span>
        <input
          aria-label="Selected video trim start"
          max={trimSliderMax}
          min="0"
          step="0.1"
          type="range"
          value={element.trimStartSeconds}
          onChange={(event) => {
            onUpdate({ trimStartSeconds: toTrimSeconds(event.target.value) });
          }}
        />
      </label>
      <label className="design-control">
        <span>Trim end {(element.trimEndSeconds ?? 0).toFixed(1)}s</span>
        <input
          aria-label="Selected video trim end"
          max={trimSliderMax}
          min="0"
          step="0.1"
          type="range"
          value={element.trimEndSeconds ?? 0}
          onChange={(event) => {
            onUpdate({ trimEndSeconds: toTrimSeconds(event.target.value) });
          }}
        />
      </label>
    </PanelSection>
  );
}
