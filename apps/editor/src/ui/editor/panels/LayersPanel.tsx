import { Eye, EyeOff, Film, GripVertical, Image, Lock, Search, Square, Trash2, Type, Unlock, Video } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import type { DesignElement, ProjectDocument, SelectionState } from '../../../domain/documents/model';
import { IconButton } from '../../components/IconButton';
import { PanelSection } from '../../components/PanelSection';

type DropPosition = 'before' | 'after';

interface LayersPanelProps {
  project: ProjectDocument;
  activePageId: string;
  selection: SelectionState;
  onSelectElement?: (elementId: string, options?: { additive?: boolean }) => void;
  onSetElementVisibility?: (elementId: string, visible: boolean) => void;
  onSetElementLock?: (elementId: string, locked: boolean) => void;
  onDeleteElement?: (elementId: string) => void;
  onReorderElement?: (elementId: string, targetElementId: string, position?: DropPosition) => void;
}

function isDesignElement(element: DesignElement | undefined): element is DesignElement {
  return Boolean(element);
}

function getLayerLabel(element: DesignElement, project: ProjectDocument) {
  if (element.id === 'text-title') return 'Title';
  if (element.id.startsWith('text-title-copy')) return 'Title copy';
  if (element.id === 'text-subtitle') return 'Subtitle';
  if (element.id.startsWith('text-subtitle-copy')) return 'Subtitle copy';
  if (element.id === 'image-hero') return 'Selected Image';
  if (element.type === 'image' && element.assetId === 'asset-hero') return 'Selected Image copy';
  if (element.type === 'image' && element.id.includes('-copy')) {
    return `${project.assets[element.assetId]?.name ?? 'Imported Image'} copy`;
  }
  if (element.type === 'image') return project.assets[element.assetId]?.name ?? 'Imported Image';
  if (element.type === 'gif') return project.assets[element.assetId]?.name ?? 'Imported GIF';
  if (element.type === 'video') return project.assets[element.assetId]?.name ?? 'Imported Video';
  if (element.type === 'text') return element.text.trim().split('\n')[0] || 'Text';
  return 'Background Shape';
}

function getLayerIcon(element: DesignElement) {
  if (element.type === 'text') return Type;
  if (element.type === 'image') return Image;
  if (element.type === 'gif') return Film;
  if (element.type === 'video') return Video;
  return Square;
}

function getDropPosition(event: DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

export function LayersPanel({
  project,
  activePageId,
  selection,
  onSelectElement,
  onSetElementVisibility,
  onSetElementLock,
  onDeleteElement,
  onReorderElement,
}: LayersPanelProps) {
  const [dropIndicator, setDropIndicator] = useState<{ layerId: string; position: DropPosition } | undefined>();
  const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
  const selectedElementId = selection.elementIds[0];
  const layers =
    [...(page?.elementIds ?? [])]
      .reverse()
      .map((id) => project.elements[id])
      .filter(isDesignElement)
      .map((element) => ({
        id: element.id,
        name: getLayerLabel(element, project),
        icon: getLayerIcon(element),
        selected: selection.elementIds.includes(element.id),
        type: element.type,
        visible: element.visible !== false,
        locked: element.locked,
      })) ?? [];
  const selectedLayer = layers.find((layer) => layer.selected);

  return (
    <div className="panel-stack">
      <div className="layer-search ew-surface ew-compact-row">
        <Search size={15} />
        <input aria-label="Search layers" placeholder="Search layers" type="search" />
      </div>
      <PanelSection title="Stack">
        <p className="panel-muted">{layers.length + 1} layers on current page</p>
        <div className="layer-list ew-panel-card">
          {layers.map((layer) => {
            const Icon = layer.icon;
            const dropPosition = dropIndicator?.layerId === layer.id ? dropIndicator.position : undefined;
            const rowClassName = [
              'layer-row',
              'ew-surface',
              'ew-surface-hover',
              'ew-compact-row',
              layer.selected ? 'layer-row-selected' : '',
              dropPosition === 'before' ? 'drop-indicator-before' : '',
              dropPosition === 'after' ? 'drop-indicator-after' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <article
                key={layer.id}
                className={rowClassName}
                data-drop-position={dropPosition}
                role="button"
                tabIndex={0}
                aria-label={layer.name}
                aria-pressed={layer.selected}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', layer.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDropIndicator(undefined);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropIndicator({ layerId: layer.id, position: getDropPosition(event) });
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                  setDropIndicator((current) => (current?.layerId === layer.id ? undefined : current));
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const position = getDropPosition(event);
                  setDropIndicator(undefined);
                  const draggedElementId = event.dataTransfer.getData('text/plain');
                  if (!draggedElementId || draggedElementId === layer.id) return;
                  onReorderElement?.(draggedElementId, layer.id, position);
                }}
                onClick={(event) => {
                  if (event.shiftKey) {
                    onSelectElement?.(layer.id, { additive: true });
                    return;
                  }
                  onSelectElement?.(layer.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  if (event.shiftKey) {
                    onSelectElement?.(layer.id, { additive: true });
                    return;
                  }
                  onSelectElement?.(layer.id);
                }}
                >
                  <GripVertical size={15} />
                  <Icon size={16} />
                <span className="layer-row-name ew-ellipsis">{layer.name}</span>
                <span
                  className="layer-row-actions"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <IconButton
                    active={!layer.visible}
                    label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                    onClick={() => {
                      onSetElementVisibility?.(layer.id, !layer.visible);
                    }}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </IconButton>
                  <IconButton
                    active={layer.locked}
                    label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                    onClick={() => {
                      onSetElementLock?.(layer.id, !layer.locked);
                    }}
                  >
                    {layer.locked ? <Unlock size={13} /> : <Lock size={13} />}
                  </IconButton>
                  <IconButton
                    label={`Delete ${layer.name}`}
                    onClick={() => {
                      onDeleteElement?.(layer.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </span>
              </article>
            );
          })}
          <article className="layer-row layer-row-static ew-surface ew-compact-row">
            <GripVertical size={15} />
            <Square size={16} />
            <span className="layer-row-name ew-ellipsis">Page Background</span>
          </article>
        </div>
      </PanelSection>
      <PanelSection title="Selected Layer">
        <div className="property-row ew-surface ew-surface-hover ew-compact-row">
          <span>Type</span>
          <strong>{selectedLayer?.type ?? (selectedElementId ? 'Missing' : 'None')}</strong>
        </div>
        <div className="property-row ew-surface ew-surface-hover ew-compact-row">
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
