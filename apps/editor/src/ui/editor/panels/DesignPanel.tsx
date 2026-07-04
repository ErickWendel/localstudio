import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  CaseSensitive,
  Download,
  FileVideo,
  Film,
  FolderOpen,
  Image,
  Plus,
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

const palette = ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'];
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

interface DesignPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  availableFonts?: FontCatalogItem[];
  focusFontControlKey?: number | undefined;
  onDownloadFont?: (family: string) => Promise<void>;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
  onUpdateElementFrame?: (elementId: string, patch: ElementFramePatch) => void;
  onUpdateMediaPlayback?: (elementId: string, patch: MediaPlaybackPatch) => void;
  onUpdatePageBackground?: (background: PageBackground) => void;
  onAlignSelectedElement?: (mode: AlignMode) => void;
  onSetElementLock?: (elementId: string, locked: boolean) => void;
  onSetSelectedElementZOrder?: (mode: ZOrderMode) => void;
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
  onUpdateElementFrame,
  onUpdateMediaPlayback,
  onUpdatePageBackground,
  onAlignSelectedElement,
  onSetElementLock,
  onSetSelectedElementZOrder,
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

      {selectedElement?.type !== 'video' ? (
        <PanelSection title="Selection">
          <div className="compact-action design-selection-summary">
            {selectedElement?.type === 'text' ? <Type size={16} /> : null}
            {selectedElement?.type === 'image' ? <Image size={16} /> : null}
            {selectedElement?.type === 'gif' ? <Film size={16} /> : null}
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
      ) : null}

      {selectedElement?.type === 'video' ? (
        <VideoPlaybackPanel
          assetName={project.assets[selectedElement.assetId]?.name ?? 'Imported movie'}
          element={selectedElement}
          onAlign={onAlignSelectedElement}
          onFrameUpdate={(patch) => onUpdateElementFrame?.(selectedElement.id, patch)}
          onLockChange={(locked) => onSetElementLock?.(selectedElement.id, locked)}
          onUpdate={updateSelectedMediaPlayback}
          onUpdateStyle={updateSelectedStyle}
          onZOrderChange={onSetSelectedElementZOrder}
        />
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
  assetName: string;
  element: VideoElement;
  onAlign?: ((mode: AlignMode) => void) | undefined;
  onFrameUpdate?: ((patch: ElementFramePatch) => void) | undefined;
  onLockChange?: ((locked: boolean) => void) | undefined;
  onUpdate: (patch: MediaPlaybackPatch) => void;
  onUpdateStyle: (patch: ElementStylePatch) => void;
  onZOrderChange?: ((mode: ZOrderMode) => void) | undefined;
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

type MovieInspectorTab = 'arrange' | 'movie' | 'style';

function getBoundedNumber(value: string, fallback: number, minimum = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

function VideoPlaybackPanel({
  assetName,
  element,
  onAlign,
  onFrameUpdate,
  onLockChange,
  onUpdate,
  onUpdateStyle,
  onZOrderChange,
}: VideoPlaybackPanelProps) {
  const [activeTab, setActiveTab] = useState<MovieInspectorTab>('movie');
  const trimSliderMax = getTrimSliderMax(element);
  const trimEndSeconds = getTrimEndSeconds(element);
  const volume = element.muted ? 0 : Math.round((element.volume ?? 1) * 100);
  const repeatMode = getVideoRepeatMode(element);
  const locked = element.locked;

  return (
    <PanelSection title="Movie">
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
          aria-selected={activeTab === 'movie'}
          className={
            activeTab === 'movie'
              ? 'movie-inspector-tab movie-inspector-tab-active'
              : 'movie-inspector-tab'
          }
          role="tab"
          type="button"
          onClick={() => setActiveTab('movie')}
        >
          Movie
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
          <section className="movie-panel-section" aria-label="Selected movie style">
            <h3>Selection</h3>
            <div className="compact-action design-selection-summary">
              <Video size={16} />
              <span>Selected video</span>
            </div>
            <label className="design-control">
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
            <label className="design-control">
              <span>Controls</span>
              <input
                aria-label="Show selected video controls"
                checked={element.controls}
                type="checkbox"
                onChange={(event) => onUpdate({ controls: event.target.checked })}
              />
            </label>
          </section>
        </>
      ) : null}

      {activeTab === 'movie' ? (
        <>
          <section className="movie-panel-section" aria-label="Movie file info">
            <h3>File Info</h3>
            <div className="movie-file-row">
              <FileVideo size={18} aria-hidden="true" />
              <span>{assetName}</span>
              <button className="stitch-icon-button" type="button" aria-label="Browse movie file">
                <FolderOpen size={18} aria-hidden="true" />
              </button>
            </div>
          </section>

          <section className="movie-panel-section" aria-label="Movie controls">
            <h3>Controls</h3>
            <div className="movie-controls-row">
              <button
                type="button"
                aria-label="Jump movie to beginning"
                onClick={() =>
                  onUpdate({
                    playbackPositionSeconds: element.trimStartSeconds,
                    playing: false,
                  })
                }
              >
                <SkipBack size={18} aria-hidden="true" />
              </button>
              <button
                className="movie-play-button"
                type="button"
                aria-label={element.playing ? 'Pause movie' : 'Play movie'}
                aria-pressed={Boolean(element.playing)}
                onClick={() => onUpdate({ playing: !element.playing })}
              >
                <Play size={24} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Jump movie to end"
                onClick={() =>
                  onUpdate({
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
                max="100"
                min="0"
                step="1"
                type="range"
                value={volume}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  onUpdate({ muted: nextVolume === 0, volume: nextVolume / 100 });
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
                  max={trimSliderMax}
                  min="0"
                  step="0.1"
                  type="range"
                  value={element.trimStartSeconds}
                  onChange={(event) => {
                    const nextStart = Math.min(toTrimSeconds(event.target.value), trimEndSeconds);
                    onUpdate({ trimStartSeconds: nextStart });
                  }}
                />
                <input
                  aria-label="Selected video trim end"
                  max={trimSliderMax}
                  min="0"
                  step="0.1"
                  type="range"
                  value={trimEndSeconds}
                  onChange={(event) => {
                    const nextEnd = Math.max(
                      toTrimSeconds(event.target.value),
                      element.trimStartSeconds,
                    );
                    onUpdate({ trimEndSeconds: nextEnd });
                  }}
                />
              </div>
              <div className="movie-time-row">
                <span>{formatMovieTime(element.trimStartSeconds)}</span>
                <span>{formatMovieTime(trimEndSeconds)}</span>
              </div>
            </div>

            <label className="movie-poster-control">
              <span>Poster Frame</span>
              <input
                aria-label="Selected video poster frame"
                max={trimSliderMax}
                min="0"
                step="0.1"
                type="range"
                value={element.posterFrameSeconds ?? element.trimStartSeconds}
                onChange={(event) => {
                  onUpdate({ posterFrameSeconds: toTrimSeconds(event.target.value) });
                }}
              />
              <strong>{formatMovieTime(element.posterFrameSeconds ?? element.trimStartSeconds)}</strong>
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
                  onUpdate({ loop: nextRepeatMode === 'loop', repeatMode: nextRepeatMode });
                }}
              >
                {videoRepeatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="movie-checkbox-row movie-checkbox-row-disabled">
              <input type="checkbox" disabled checked={Boolean(element.startOnClick)} readOnly />
              <span>Start movie on click</span>
            </label>
            <label className="movie-checkbox-row">
              <input
                aria-label="Play movie across slides"
                type="checkbox"
                checked={Boolean(element.playAcrossSlides)}
                onChange={(event) => onUpdate({ playAcrossSlides: event.target.checked })}
              />
              <span>Play movie across slides</span>
            </label>
          </section>
        </>
      ) : null}

      {activeTab === 'arrange' ? (
        <>
          <section className="movie-panel-section" aria-label="Arrange movie order">
            <div className="movie-arrange-grid">
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
            <div className="movie-arrange-select-row">
              <select
                aria-label="Align selected video"
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

          <section className="movie-panel-section" aria-label="Movie size">
            <h3>Size</h3>
            <div className="movie-number-grid">
              <label>
                <input
                  aria-label="Selected video width"
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
                  aria-label="Selected video height"
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

          <section className="movie-panel-section" aria-label="Movie position">
            <h3>Position</h3>
            <div className="movie-number-grid">
              <label>
                <input
                  aria-label="Selected video x position"
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
                  aria-label="Selected video y position"
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

          <section className="movie-panel-section" aria-label="Movie rotation">
            <h3>Rotate</h3>
            <div className="movie-number-grid">
              <label>
                <input
                  aria-label="Selected video rotation"
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

          <section className="movie-panel-section" aria-label="Movie lock and grouping">
            <div className="movie-lock-grid">
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
