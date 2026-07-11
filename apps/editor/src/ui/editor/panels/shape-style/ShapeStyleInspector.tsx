import type { ShapeElement, ShapeLineEndpoint } from '../../../../domain/documents/model';
import type { ElementStylePatch } from '../../../../domain/commands/elements/basicCommands';
import { DesignColorField } from '../design-controls/DesignColorField';
import { DesignSelectField } from '../design-controls/DesignSelectField';

const colorFillOptions = [
  { value: 'none', label: 'No fill' },
  { value: 'color', label: 'Color fill' },
] as const;
const colorBorderOptions = [
  { value: 'none', label: 'No border' },
  { value: 'color', label: 'Color border' },
] as const;
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

interface ShapeStyleInspectorProps {
  element: ShapeElement;
  onUpdateStyle: (patch: ElementStylePatch) => void;
}

function supportsLineEndpoints(element: ShapeElement) {
  return element.shape === 'arc' || element.shape === 'arrow' || element.shape === 'line';
}

export function ShapeStyleInspector({ element, onUpdateStyle }: ShapeStyleInspectorProps) {
  return (
    <section className="movie-panel-section" aria-label="Selected shape controls">
      <h3>Shape</h3>
      <DesignSelectField
        ariaLabel="Selected shape fill mode"
        label="Fill"
        options={colorFillOptions}
        value={element.fill ? 'color' : 'none'}
        onChange={(value) => {
          onUpdateStyle({
            fill: value === 'color' ? (element.fill ?? '#37FD76') : null,
          });
        }}
      />
      {element.fill ? (
        <DesignColorField
          ariaLabel="Selected shape fill color"
          label="Fill color"
          value={element.fill}
          onChange={(fill) => {
            onUpdateStyle({ fill });
          }}
        />
      ) : null}
      <DesignSelectField
        ariaLabel="Selected shape border mode"
        label="Border"
        options={colorBorderOptions}
        value={element.stroke && (element.strokeWidth ?? 0) > 0 ? 'color' : 'none'}
        onChange={(value) => {
          onUpdateStyle(
            value === 'color'
              ? {
                  stroke: element.stroke ?? '#37FD76',
                  strokeWidth: element.strokeWidth && element.strokeWidth > 0 ? element.strokeWidth : 2,
                }
              : { stroke: null, strokeWidth: 0 },
          );
        }}
      />
      {element.stroke && (element.strokeWidth ?? 0) > 0 ? (
        <>
          <DesignColorField
            ariaLabel="Selected shape border color"
            label="Border color"
            value={element.stroke}
            onChange={(stroke) => {
              onUpdateStyle({ stroke });
            }}
          />
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
              <DesignSelectField
                ariaLabel="Selected shape start endpoint"
                label="Start endpoint"
                options={shapeLineEndpointOptions}
                value={element.startEndpoint ?? 'none'}
                onChange={(value) => {
                  onUpdateStyle({
                    startEndpoint: value as ShapeLineEndpoint,
                  });
                }}
              />
              <DesignSelectField
                ariaLabel="Selected shape end endpoint"
                label="End endpoint"
                options={shapeLineEndpointOptions}
                value={element.endEndpoint ?? (element.shape === 'arrow' ? 'arrow' : 'none')}
                onChange={(value) => {
                  onUpdateStyle({
                    endEndpoint: value as ShapeLineEndpoint,
                  });
                }}
              />
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
