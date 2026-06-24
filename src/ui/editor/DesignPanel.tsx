import { AlignCenter, Palette, Type } from 'lucide-react';
import { PanelSection } from '../components/PanelSection';

const palette = ['#37FD76', '#050D10', '#FFFFFF', '#91999D', '#00779A'];

export function DesignPanel() {
  return (
    <div className="panel-stack">
      <PanelSection title="Canvas">
        <div className="property-row">
          <span>Format</span>
          <strong>16:9 Presentation</strong>
        </div>
        <div className="property-row">
          <span>Background</span>
          <strong>#050D10</strong>
        </div>
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
            />
          ))}
        </div>
      </PanelSection>
      <PanelSection title="Typography">
        <div className="compact-action">
          <Type size={16} />
          <span>Orbitron / Open Sans</span>
        </div>
        <div className="compact-action">
          <AlignCenter size={16} />
          <span>Center selected element</span>
        </div>
      </PanelSection>
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
