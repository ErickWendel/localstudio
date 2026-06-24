import { Eye, GripVertical, Image, Lock, Search, Square, Type } from 'lucide-react';
import type { DesignElement, ProjectDocument, SelectionState } from '../../domain/model';
import { IconButton } from '../components/IconButton';
import { PanelSection } from '../components/PanelSection';

interface LayersPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onSelectElement?: (elementId: string) => void;
}

function isDesignElement(element: DesignElement | undefined): element is DesignElement {
  return Boolean(element);
}

function getLayerLabel(element: DesignElement) {
  if (element.id === 'text-title') return 'Title';
  if (element.id === 'text-subtitle') return 'Subtitle';
  if (element.type === 'image') return 'Selected Image';
  if (element.type === 'shape') return 'Background Shape';
  return element.id;
}

function getLayerIcon(element: DesignElement) {
  if (element.type === 'text') return Type;
  if (element.type === 'image') return Image;
  return Square;
}

export function LayersPanel({ project, activePageId, selection, onSelectElement }: LayersPanelProps) {
  const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
  const layers =
    [...(page?.elementIds ?? [])]
      .reverse()
      .map((id) => project.elements[id])
      .filter(isDesignElement)
      .map((element) => ({
        id: element.id,
        name: getLayerLabel(element),
        icon: getLayerIcon(element),
        selected: selection.elementIds.includes(element.id),
        type: element.type,
      })) ?? [];
  const selectedLayer = layers.find((layer) => layer.selected);

  return (
    <div className="panel-stack">
      <div className="layer-search">
        <Search size={15} />
        <input aria-label="Search layers" placeholder="Search layers" type="search" />
      </div>
      <PanelSection title="Stack">
        <p className="panel-muted">{layers.length + 1} layers on current page</p>
        <div className="layer-list">
          {layers.map((layer) => {
            const Icon = layer.icon;
            return (
              <article
                key={layer.id}
                className={layer.selected ? 'layer-row layer-row-selected' : 'layer-row'}
                role="button"
                tabIndex={0}
                aria-label={layer.name}
                aria-pressed={layer.selected}
                onClick={() => {
                  onSelectElement?.(layer.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  onSelectElement?.(layer.id);
                }}
                >
                  <GripVertical size={15} />
                  <Icon size={16} />
                <span className="layer-row-name">{layer.name}</span>
                <span
                  className="layer-row-actions"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <IconButton
                    label={`Toggle ${layer.name} visibility`}
                    onClick={() => {
                      // Visibility controls are visual-only in the MVP.
                    }}
                  >
                    <Eye size={13} />
                  </IconButton>
                  <IconButton
                    label={`Lock ${layer.name}`}
                    onClick={() => {
                      // Lock controls are visual-only in the MVP.
                    }}
                  >
                    <Lock size={13} />
                  </IconButton>
                </span>
              </article>
            );
          })}
          <article className="layer-row layer-row-static">
            <GripVertical size={15} />
            <Square size={16} />
            <span className="layer-row-name">Page Background</span>
          </article>
        </div>
      </PanelSection>
      <PanelSection title="Selected Layer">
        <div className="property-row">
          <span>Type</span>
          <strong>{selectedLayer?.type ?? 'None'}</strong>
        </div>
        <div className="property-row">
          <span>Z-order</span>
          <strong>
            {selectedLayer
              ? `${layers.length - layers.findIndex((layer) => layer.id === selectedLayer.id)} / ${layers.length}`
              : '-'}
          </strong>
        </div>
      </PanelSection>
    </div>
  );
}
