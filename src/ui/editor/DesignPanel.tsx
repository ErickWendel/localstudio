import { AlignCenter, CaseSensitive, Image, Palette, Square, Type } from 'lucide-react';
import type {
  DesignElement,
  PageBackground,
  ProjectDocument,
  SelectionState,
} from '../../domain/model';
import { PanelSection } from '../components/PanelSection';

const palette = ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'];
const fontFamilies = ['Orbitron', 'Open Sans', 'Inter', 'Arial'];
const fontWeights = [400, 600, 700, 800, 900];

interface DesignPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onUpdateElementStyle?: (
    elementId: string,
    patch: Partial<{
      align: 'left' | 'center' | 'right';
      fill: string;
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      opacity: number;
      stroke: string;
      strokeWidth: number;
    }>,
  ) => void;
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
  onUpdatePageBackground,
}: DesignPanelProps) {
  const page = project.pages.find((item) => item.id === activePageId);
  const selectedElement = getSelectedElement(project, selection);
  const backgroundColor = page ? getBackgroundColor(page.background) : '#050D10';

  function updateSelectedStyle(patch: Parameters<NonNullable<typeof onUpdateElementStyle>>[1]) {
    if (!selectedElement || selectedElement.locked) return;
    onUpdateElementStyle?.(selectedElement.id, patch);
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
              {fontFamilies.map((fontFamily) => (
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
              {fontWeights.map((fontWeight) => (
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

      {selectedElement?.type === 'shape' ? (
        <PanelSection title="Shape">
          <label className="design-control">
            <span>Fill</span>
            <input
              aria-label="Selected shape fill"
              type="color"
              value={selectedElement.fill}
              onChange={(event) => {
                updateSelectedStyle({ fill: event.target.value });
              }}
            />
          </label>
          <label className="design-control">
            <span>Stroke</span>
            <input
              aria-label="Selected shape stroke"
              type="color"
              value={selectedElement.stroke ?? '#37FD76'}
              onChange={(event) => {
                updateSelectedStyle({ stroke: event.target.value });
              }}
            />
          </label>
          <label className="design-control">
            <span>Stroke width</span>
            <input
              aria-label="Selected shape stroke width"
              min="0"
              type="number"
              value={selectedElement.strokeWidth ?? 0}
              onChange={(event) => {
                updateSelectedStyle({ strokeWidth: Number(event.target.value) });
              }}
            />
          </label>
        </PanelSection>
      ) : null}

      <PanelSection title="AI Palette">
        <div className="tool-card compact-tool">
          <div className="tool-card-heading">
            <Palette size={18} />
            <strong>Text-to-Palette</strong>
          </div>
          <p>Apply generated colors to the current design.</p>
        </div>
      </PanelSection>
    </div>
  );
}
