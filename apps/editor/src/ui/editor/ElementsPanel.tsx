import {
  ArrowRight,
  Circle,
  Diamond,
  Minus,
  Pentagon,
  RectangleHorizontal,
  Square,
  Triangle,
  type LucideIcon,
} from 'lucide-react';
import type { ShapeKind } from '../../domain/model';

export const elementShapeCatalog: Array<{
  icon?: LucideIcon;
  label: string;
  shape: ShapeKind;
}> = [
  { shape: 'ellipse', label: 'circle', icon: Circle },
  { shape: 'line', label: 'line', icon: Minus },
  { shape: 'rect', label: 'square', icon: Square },
  { shape: 'rounded-rect', label: 'rounded rectangle', icon: RectangleHorizontal },
  { shape: 'triangle', label: 'triangle', icon: Triangle },
  { shape: 'pentagon', label: 'pentagon', icon: Pentagon },
  { shape: 'diamond', label: 'diamond', icon: Diamond },
  { shape: 'parallelogram', label: 'parallelogram' },
  { shape: 'arrow', label: 'arrow', icon: ArrowRight },
  { shape: 'arc', label: 'arc' },
];

interface ElementsPanelProps {
  onInsertShape?: (shape: ShapeKind) => void;
}

export function ElementsPanel({ onInsertShape }: ElementsPanelProps) {
  return (
    <section className="panel-stack" aria-label="Elements tools">
      <div className="panel-section">
        <h2 className="panel-heading">Elements</h2>
        <p className="panel-muted">Add editable shapes to the current slide.</p>
      </div>
      <div className="elements-grid" aria-label="Shape elements">
        {elementShapeCatalog.map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-label={`Add ${item.label}`}
              className="element-tile"
              key={item.shape}
              type="button"
              onClick={() => {
                onInsertShape?.(item.shape);
              }}
            >
              <ShapeTilePreview shape={item.shape} />
              {Icon ? <Icon aria-hidden="true" className="element-tile-icon" size={24} strokeWidth={2.2} /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ShapeTilePreview({ shape }: { shape: ShapeKind }) {
  if (shape === 'parallelogram') return <span className="element-shape-preview element-preview-parallelogram" />;
  if (shape === 'arc') {
    return (
      <svg aria-hidden="true" className="element-shape-preview-svg" viewBox="0 0 48 48">
        <path d="M9 38 C10 14 32 9 39 20" />
        <path d="M34 11 L40 20 L29 22" />
      </svg>
    );
  }
  return null;
}
