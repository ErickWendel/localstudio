import {
  Eye,
  EyeOff,
  Film,
  GripVertical,
  Image,
  LayoutGrid,
  Lock,
  Search,
  Square,
  Trash2,
  Type,
  Unlock,
  Video,
} from 'lucide-react';
import { useState, type CSSProperties, type DragEvent, type FormEvent } from 'react';
import type {
  DesignElement,
  ProjectDocument,
  SelectionState,
} from '../../../domain/documents/model';
import type {
  ImageGridFit,
  ImageGridMediaPosition,
  ImageGridPreset,
  ImageGridRequest,
  SelectionGridRequest,
} from '../state/editorViewModelElements';
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
  onApplyGridToSelection?: (request: SelectionGridRequest) => void;
  onInsertImageGrid?: (request: ImageGridRequest) => void;
  onReorderElement?: (elementId: string, targetElementId: string, position?: DropPosition) => void;
}

const CUSTOM_IMAGE_GRID_LIMIT = 6;
const CUSTOM_TEXT_PLACEHOLDER_LIMIT = 6;

const imageGridPresets: Array<{
  label: string;
  preset: ImageGridPreset;
  preview: number[];
}> = [
  { label: '1 image', preset: 'one', preview: [1] },
  { label: '2 images', preset: 'two-columns', preview: [2] },
  { label: '3 images', preset: 'three-two-one', preview: [2, 1] },
  { label: '4 images', preset: 'four-square', preview: [2, 2] },
];

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

function parseBoundedInteger(value: string, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return undefined;
  if (parsed < 0 || parsed > max) return undefined;
  return parsed;
}

export function LayersPanel({
  project,
  activePageId,
  selection,
  onSelectElement,
  onSetElementVisibility,
  onSetElementLock,
  onDeleteElement,
  onApplyGridToSelection,
  onInsertImageGrid,
  onReorderElement,
}: LayersPanelProps) {
  const [dropIndicator, setDropIndicator] = useState<
    { layerId: string; position: DropPosition } | undefined
  >();
  const [customColumns, setCustomColumns] = useState('1');
  const [customRows, setCustomRows] = useState('1');
  const [customTextCount, setCustomTextCount] = useState('1');
  const [customMediaPosition, setCustomMediaPosition] =
    useState<ImageGridMediaPosition>('left');
  const [customImageFit, setCustomImageFit] = useState<ImageGridFit>('cover');
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
  const gridEditMode = selection.elementIds.length > 1;
  const selectedTextCount = layers.filter(
    (layer) => layer.selected && layer.type === 'text',
  ).length;
  const balancedSelectionColumns = Math.max(1, Math.ceil(Math.sqrt(selection.elementIds.length)));
  const balancedSelectionRows = Math.max(
    1,
    Math.ceil(selection.elementIds.length / balancedSelectionColumns),
  );
  const customColumnsControlValue =
    gridEditMode && customColumns === '1' && customRows === '1'
      ? String(balancedSelectionColumns)
      : customColumns;
  const customRowsControlValue =
    gridEditMode && customColumns === '1' && customRows === '1'
      ? String(balancedSelectionRows)
      : customRows;
  const customColumnsValue = parseBoundedInteger(
    customColumnsControlValue,
    CUSTOM_IMAGE_GRID_LIMIT,
  );
  const customRowsValue = parseBoundedInteger(customRowsControlValue, CUSTOM_IMAGE_GRID_LIMIT);
  const customTextCountValue = parseBoundedInteger(customTextCount, CUSTOM_TEXT_PLACEHOLDER_LIMIT);
  const customGrid =
    customColumnsValue && customRowsValue && customTextCountValue !== undefined
      ? {
          columns: customColumnsValue,
          imageFit: customImageFit,
          mediaPosition: customMediaPosition,
          rows: customRowsValue,
          textCount: gridEditMode ? selectedTextCount : customTextCountValue,
        }
      : undefined;
  const customGridInvalid = !customGrid;
  const submitCustomGrid = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customGrid) return;
    if (gridEditMode) {
      onApplyGridToSelection?.(customGrid);
      return;
    }
    onInsertImageGrid?.(customGrid);
  };

  return (
    <div className="panel-stack">
      <div className="layer-search ew-surface ew-compact-row">
        <Search size={15} />
        <input aria-label="Search layers" placeholder="Search layers" type="search" />
      </div>
      <PanelSection title={gridEditMode ? 'Edit selected grid' : 'Image grids'}>
        {gridEditMode ? (
          <p className="panel-muted">{selection.elementIds.length} selected elements</p>
        ) : (
          <div className="layout-image-grid-options">
            {imageGridPresets.map((preset) => (
              <button
                aria-label={`Insert ${preset.label} grid`}
                className="layout-image-grid-option ew-surface ew-surface-hover"
                disabled={!onInsertImageGrid}
                key={preset.preset}
                type="button"
                onClick={() => onInsertImageGrid?.(preset.preset)}
              >
                <LayoutGrid size={15} />
                <GridPresetPreview rows={preset.preview} />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        )}
        <form className="layout-custom-grid-form" onSubmit={submitCustomGrid}>
          <span className="layout-custom-grid-label">Custom grid</span>
          <div className="layout-custom-grid-fields">
            <label className="layout-custom-grid-field">
              <span>Columns</span>
              <input
                aria-label="Grid columns"
                inputMode="numeric"
                min={1}
                max={CUSTOM_IMAGE_GRID_LIMIT}
                type="number"
                value={customColumnsControlValue}
                onChange={(event) => {
                  setCustomColumns(event.currentTarget.value);
                }}
              />
            </label>
            <label className="layout-custom-grid-field">
              <span>Rows</span>
              <input
                aria-label="Grid rows"
                inputMode="numeric"
                min={1}
                max={CUSTOM_IMAGE_GRID_LIMIT}
                type="number"
                value={customRowsControlValue}
                onChange={(event) => {
                  setCustomRows(event.currentTarget.value);
                }}
              />
            </label>
            <label className="layout-custom-grid-field">
              <span>Text</span>
              <input
                aria-label="Text placeholders"
                disabled={gridEditMode}
                inputMode="numeric"
                min={0}
                max={CUSTOM_TEXT_PLACEHOLDER_LIMIT}
                type="number"
                value={gridEditMode ? String(selectedTextCount) : customTextCount}
                onChange={(event) => {
                  setCustomTextCount(event.currentTarget.value);
                }}
              />
            </label>
          </div>
          <span className="layout-custom-grid-label">Arrangement</span>
          <div className="layout-custom-grid-row">
            <select
              aria-label="Media position"
              value={customMediaPosition}
              onChange={(event) => {
                setCustomMediaPosition(event.currentTarget.value as ImageGridMediaPosition);
              }}
            >
              <option value="left">Images left, text right</option>
              <option value="right">Text left, images right</option>
              <option value="top">Images top, text bottom</option>
              <option value="bottom">Text top, images bottom</option>
            </select>
          </div>
          <span className="layout-custom-grid-label">Image behavior</span>
          <div className="layout-custom-grid-row">
            <select
              aria-label="Image fit"
              value={customImageFit}
              onChange={(event) => {
                setCustomImageFit(event.currentTarget.value as ImageGridFit);
              }}
            >
              <option value="cover">object-fit: cover</option>
              <option value="contain">object-fit: contain</option>
              <option value="stretch">object-fit: fill</option>
            </select>
            <button
              className="layout-custom-grid-submit ew-surface ew-surface-hover"
              disabled={
                gridEditMode
                  ? !onApplyGridToSelection || !customGrid
                  : !onInsertImageGrid || !customGrid
              }
              type="submit"
            >
              <LayoutGrid size={14} />
              <span>{gridEditMode ? 'Update selection' : 'Insert'}</span>
            </button>
          </div>
          <p className={customGridInvalid ? 'layout-custom-grid-error' : 'panel-muted'}>
            Cover fills to the cell border. Fill may distort placeholders.
          </p>
          {customGrid ? (
            <CustomGridPreview
              columns={customGrid.columns}
              imageFit={customGrid.imageFit}
              mediaPosition={customGrid.mediaPosition}
              rows={customGrid.rows}
              textCount={customGrid.textCount}
            />
          ) : null}
        </form>
      </PanelSection>
      <PanelSection title="Stack">
        <p className="panel-muted">{layers.length + 1} layers on current page</p>
        <div className="layer-list ew-panel-card">
          {layers.map((layer) => {
            const Icon = layer.icon;
            const dropPosition =
              dropIndicator?.layerId === layer.id ? dropIndicator.position : undefined;
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
                  setDropIndicator((current) =>
                    current?.layerId === layer.id ? undefined : current,
                  );
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

function GridPresetPreview({ rows }: { rows: number[] }) {
  return (
    <span className="layout-image-grid-preview" aria-hidden="true">
      {rows.map((count, rowIndex) => (
        <span className="layout-image-grid-preview-row" key={`${count}-${rowIndex}`}>
          {Array.from({ length: count }, (_, index) => (
            <span className="layout-image-grid-preview-cell" key={index} />
          ))}
        </span>
      ))}
    </span>
  );
}

function CustomGridPreview({
  columns,
  imageFit,
  mediaPosition,
  rows,
  textCount,
}: {
  columns: number;
  imageFit: ImageGridFit;
  mediaPosition: ImageGridMediaPosition;
  rows: number;
  textCount: number;
}) {
  const previewStyle = {
    '--layout-custom-grid-columns': columns,
    '--layout-custom-grid-rows': rows,
  } as CSSProperties;
  const imageGrid = (
    <div
      className={`layout-custom-grid-preview-stage layout-custom-grid-preview-stage-${imageFit}`}
      style={previewStyle}
    >
      {Array.from({ length: columns * rows }, (_, index) => (
        <span className="layout-custom-grid-preview-cell" key={index}>
          <span className="layout-custom-grid-preview-media" />
        </span>
      ))}
    </div>
  );
  const textStack =
    textCount > 0 ? (
      <div className="layout-custom-grid-preview-text-stack">
        {Array.from({ length: textCount }, (_, index) => (
          <span className="layout-custom-grid-preview-text" key={index}>
            T
          </span>
        ))}
      </div>
    ) : null;
  const horizontal = mediaPosition === 'left' || mediaPosition === 'right';
  const className = [
    'layout-custom-grid-preview-content',
    textCount === 0 ? 'layout-custom-grid-preview-content-single' : '',
    horizontal ? 'layout-custom-grid-preview-content-horizontal' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const children =
    mediaPosition === 'right' || mediaPosition === 'bottom'
      ? [textStack, imageGrid]
      : [imageGrid, textStack];

  return (
    <div
      aria-label={`Custom grid preview ${columns} columns by ${rows} rows, ${textCount} text placeholders, ${imageFit} image fit`}
      className="layout-custom-grid-preview"
      role="img"
    >
      <div className={className}>
        {children.map((child, index) => (child ? <div key={index}>{child}</div> : null))}
      </div>
    </div>
  );
}
