import { AlignCenter, CaseSensitive, Film, Image, Square, Type, Video } from 'lucide-react';
import type {
  DesignElement,
  PageBackground,
  ProjectDocument,
  SelectionState,
  VideoElement,
} from '../../../domain/documents/model';
import type { ElementStylePatch, MediaPlaybackPatch } from '../../../domain/commands/elements/basicCommands';
import { PanelSection } from '../../components/PanelSection';
import { textStyleOptions } from '../text/textStyleOptions';

const palette = ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'];

interface DesignPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onUpdateElementStyle?: (elementId: string, patch: ElementStylePatch) => void;
  onUpdateMediaPlayback?: (elementId: string, patch: MediaPlaybackPatch) => void;
  onUpdatePageBackground?: (background: PageBackground) => void;
}

function getSelectedElement(project: ProjectDocument, selection: SelectionState): DesignElement | undefined {
  return project.elements[selection.elementIds[0] ?? ''];
}

function getBackgroundColor(background: PageBackground) {
  return background.type === 'color' ? background.color : background.colorFallback;
}

export function DesignPanel({
  project,
  activePageId,
  selection,
  onUpdateElementStyle,
  onUpdateMediaPlayback,
  onUpdatePageBackground,
}: DesignPanelProps) {
  const page = project.pages.find((item) => item.id === activePageId);
  const selectedElement = getSelectedElement(project, selection);
  const backgroundColor = page ? getBackgroundColor(page.background) : '#050D10';

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

      <PanelSection title="Selection">
        <div className="compact-action design-selection-summary">
          {selectedElement?.type === 'text' ? <Type size={16} /> : null}
          {selectedElement?.type === 'image' ? <Image size={16} /> : null}
          {selectedElement?.type === 'gif' ? <Film size={16} /> : null}
          {selectedElement?.type === 'video' ? <Video size={16} /> : null}
          {selectedElement?.type === 'shape' ? <Square size={16} /> : null}
          {!selectedElement ? <CaseSensitive size={16} /> : null}
          <span>{selectedElement ? `Selected ${selectedElement.type}` : 'No selected element'}</span>
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

      {selectedElement?.type === 'text' ? (
        <PanelSection title="Typography">
          <label className="design-control">
            <span>Font</span>
            <select
              aria-label="Selected text font"
              value={selectedElement.fontFamily}
              onChange={(event) => {
                updateSelectedStyle({ fontFamily: event.target.value });
              }}
            >
              {textStyleOptions.TEXT_FONT_FAMILIES.map((fontFamily) => (
                <option key={fontFamily} value={fontFamily}>
                  {fontFamily}
                </option>
              ))}
            </select>
          </label>
          <label className="design-control">
            <span>Size</span>
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
          <label className="design-control">
            <span>Weight</span>
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
          <label className="design-control">
            <span>Color</span>
            <input
              aria-label="Selected text color"
              type="color"
              value={selectedElement.fill}
              onChange={(event) => {
                updateSelectedStyle({ fill: event.target.value });
              }}
            />
          </label>
          <label className="design-control">
            <span>Align</span>
            <select
              aria-label="Selected text alignment"
              value={selectedElement.align}
              onChange={(event) => {
                updateSelectedStyle({ align: event.target.value as 'left' | 'center' | 'right' });
              }}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <div className="compact-action">
            <AlignCenter size={16} />
            <span>Text frame stays editable on canvas</span>
          </div>
        </PanelSection>
      ) : null}

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
                  fill: event.target.value === 'color' ? selectedElement.fill ?? '#37FD76' : null,
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
              value={selectedElement.stroke && (selectedElement.strokeWidth ?? 0) > 0 ? 'color' : 'none'}
              onChange={(event) => {
                updateSelectedStyle(
                  event.target.value === 'color'
                    ? {
                        stroke: selectedElement.stroke ?? '#37FD76',
                        strokeWidth: selectedElement.strokeWidth && selectedElement.strokeWidth > 0 ? selectedElement.strokeWidth : 2,
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
