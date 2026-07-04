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
import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import type { ShapeKind } from '../../../domain/documents/model';
import type {
  StockMediaItem,
  StockMediaProviderState,
} from '../../../services/contracts/interfaces';
import type { StockMediaErrorState } from '../state/useEditorViewModel';

const elementShapeCatalog: Array<{
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
  gifResults?: StockMediaItem[] | undefined;
  imageResults?: StockMediaItem[] | undefined;
  loadingGifs?: boolean | undefined;
  loadingImages?: boolean | undefined;
  onInsertShape?: ((shape: ShapeKind) => void) | undefined;
  onConfigureStockMedia?: (() => void) | undefined;
  onInsertStockMedia?: ((item: StockMediaItem) => void) | undefined;
  onSearchStockGifs?: ((query: string) => void) | undefined;
  onSearchStockImages?: ((query: string) => void) | undefined;
  recentStockMedia?: StockMediaItem[] | undefined;
  stockMediaError?: StockMediaErrorState | undefined;
  stockMediaProviderState?: StockMediaProviderState | undefined;
}

const defaultProviderState: StockMediaProviderState = {
  gifs: { configured: false, provider: 'giphy' },
  images: { configured: false, provider: 'unsplash' },
};
const MEDIA_PAGE_SIZE = 10;

export function ElementsPanel({
  gifResults = [],
  imageResults = [],
  loadingGifs = false,
  loadingImages = false,
  onConfigureStockMedia,
  onInsertShape,
  onInsertStockMedia,
  onSearchStockGifs,
  onSearchStockImages,
  recentStockMedia = [],
  stockMediaError,
  stockMediaProviderState = defaultProviderState,
}: ElementsPanelProps) {
  const shapeGridRef = useRef<HTMLDivElement>(null);

  const scrollShapes = () => {
    const grid = shapeGridRef.current;
    grid?.scrollBy({ behavior: 'smooth', left: grid.clientWidth || 220 });
  };

  return (
    <section className="panel-stack" aria-label="Elements tools">
      <div className="panel-section ew-panel-card element-section">
        <h2 className="panel-heading">Elements</h2>
        <p className="panel-muted">Add shapes, images, and GIFs to the current slide.</p>
      </div>
      <ElementSectionHeader title="Shapes" seeAllLabel="See all Shapes" onSeeAll={scrollShapes} />
      <ShapeGrid gridRef={shapeGridRef} onInsertShape={onInsertShape} />
      {recentStockMedia.length > 0 ? (
        <MediaSection
          key={getMediaItemsKey(recentStockMedia)}
          items={recentStockMedia}
          title="Recently used"
          onInsertStockMedia={onInsertStockMedia}
        />
      ) : null}
      <MediaProviderSection
        configured={stockMediaProviderState.images.configured}
        inputLabel="Search Unsplash images"
        error={stockMediaError?.images}
        items={imageResults}
        loading={loadingImages}
        providerLabel="Unsplash"
        searchPlaceholder="search images"
        title="Images"
        typeLabel="image"
        onConfigureStockMedia={onConfigureStockMedia}
        onInsertStockMedia={onInsertStockMedia}
        onSearch={onSearchStockImages}
      />
      <MediaProviderSection
        configured={stockMediaProviderState.gifs.configured}
        inputLabel="Search GIPHY GIFs"
        error={stockMediaError?.gifs}
        items={gifResults}
        loading={loadingGifs}
        providerLabel="GIPHY"
        searchPlaceholder="search gifs"
        title="GIFs"
        typeLabel="GIF"
        onConfigureStockMedia={onConfigureStockMedia}
        onInsertStockMedia={onInsertStockMedia}
        onSearch={onSearchStockGifs}
      />
    </section>
  );
}

function ShapeGrid({
  gridRef,
  onInsertShape,
}: {
  gridRef: RefObject<HTMLDivElement | null>;
  onInsertShape?: ((shape: ShapeKind) => void) | undefined;
}) {
  return (
    <div className="elements-grid" ref={gridRef} aria-label="Shape elements">
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
  );
}

function ElementSectionHeader({
  seeAllLabel,
  title,
  onSeeAll,
}: {
  seeAllLabel?: string | undefined;
  title: string;
  onSeeAll?: (() => void) | undefined;
}) {
  return (
    <div className="element-section-heading ew-split-row">
      <h3>{title}</h3>
      {onSeeAll ? (
        <button
          aria-label={seeAllLabel ?? `See all ${title}`}
          className="element-section-see-all"
          type="button"
          onClick={onSeeAll}
        >
          See all
        </button>
      ) : null}
    </div>
  );
}

function MediaProviderSection({
  configured,
  error,
  inputLabel,
  items,
  loading,
  providerLabel,
  searchPlaceholder,
  title,
  typeLabel,
  onConfigureStockMedia,
  onInsertStockMedia,
  onSearch,
}: {
  configured: boolean;
  error?: string | undefined;
  inputLabel: string;
  items: StockMediaItem[];
  loading: boolean;
  providerLabel: string;
  searchPlaceholder: string;
  title: string;
  typeLabel: 'GIF' | 'image';
  onConfigureStockMedia?: (() => void) | undefined;
  onInsertStockMedia?: ((item: StockMediaItem) => void) | undefined;
  onSearch?: ((query: string) => void) | undefined;
}) {
  const [query, setQuery] = useState('');

  if (!configured) {
    return (
      <section className="element-section" aria-label={title}>
        <ElementSectionHeader title={title} />
        <ProviderConfigurationCallout
          buttonLabel="Configure media integrations"
          message={`${providerLabel} is not configured.`}
          onConfigureStockMedia={onConfigureStockMedia}
        />
      </section>
    );
  }

  return (
    <section className="element-section" aria-label={title}>
      <ElementSectionHeader title={title} />
      <form
        className="media-search-row"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch?.(query.trim());
        }}
      >
        <input
          aria-label={inputLabel}
          value={query}
          placeholder={searchPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <button type="submit" aria-label={`${inputLabel} submit`}>
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
        </button>
      </form>
      {error ? (
        <ProviderConfigurationCallout
          buttonLabel="Configure media integrations"
          message={error}
          onConfigureStockMedia={onConfigureStockMedia}
        />
      ) : (
        <MediaSection
          key={getMediaItemsKey(items)}
          emptyLabel={loading ? `Loading ${title.toLowerCase()}...` : `No ${title.toLowerCase()} found.`}
          items={items}
          title={title}
          typeLabel={typeLabel}
          onInsertStockMedia={onInsertStockMedia}
        />
      )}
    </section>
  );
}

function ProviderConfigurationCallout({
  buttonLabel,
  message,
  onConfigureStockMedia,
}: {
  buttonLabel: string;
  message: string;
  onConfigureStockMedia?: (() => void) | undefined;
}) {
  return (
    <div className="provider-disabled-callout">
      <p>{message}</p>
      <button
        className="compact-action compact-action-full ew-surface ew-surface-hover ew-compact-row"
        type="button"
        onClick={onConfigureStockMedia}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          key
        </span>
        {buttonLabel}
      </button>
    </div>
  );
}

function MediaSection({
  emptyLabel = 'No media yet.',
  items,
  title,
  typeLabel,
  onInsertStockMedia,
}: {
  emptyLabel?: string | undefined;
  items: StockMediaItem[];
  title: string;
  typeLabel?: 'GIF' | 'image' | undefined;
  onInsertStockMedia?: ((item: StockMediaItem) => void) | undefined;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / MEDIA_PAGE_SIZE));
  const visibleItems = items.slice(
    pageIndex * MEDIA_PAGE_SIZE,
    pageIndex * MEDIA_PAGE_SIZE + MEDIA_PAGE_SIZE,
  );

  if (items.length === 0) return <p className="panel-muted">{emptyLabel}</p>;
  return (
    <>
      <div className="media-grid" aria-label={`${title} results`}>
        {visibleItems.map((item) => (
          <button
            aria-label={getMediaButtonLabel(item, typeLabel)}
            className="stock-media-tile"
            key={`${item.provider}-${item.id}`}
            type="button"
            title={getMediaCredit(item)}
            onClick={() => {
              onInsertStockMedia?.(item);
            }}
          >
            <img alt="" src={item.thumbnailUrl} />
            <span className="stock-media-source">{item.provider === 'unsplash' ? 'Unsplash' : 'GIPHY'}</span>
            <span className="stock-media-credit">{getMediaCredit(item)}</span>
          </button>
        ))}
      </div>
      {items.length > MEDIA_PAGE_SIZE ? (
        <div className="media-pagination" aria-label={`${title} pagination`}>
          <button
            aria-label={`Previous ${title} page`}
            className="media-pagination-button"
            type="button"
            disabled={pageIndex === 0}
            onClick={() => {
              setPageIndex((current) => Math.max(0, current - 1));
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              chevron_left
            </span>
          </button>
          <span className="media-pagination-count">{pageIndex + 1} / {pageCount}</span>
          <button
            aria-label={`Next ${title} page`}
            className="media-pagination-button"
            type="button"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => {
              setPageIndex((current) => Math.min(pageCount - 1, current + 1));
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              chevron_right
            </span>
          </button>
        </div>
      ) : null}
    </>
  );
}

function getMediaItemsKey(items: StockMediaItem[]) {
  return items.map((item) => `${item.provider}:${item.id}`).join('|');
}
function getMediaButtonLabel(item: StockMediaItem, typeLabel?: 'GIF' | 'image') {
  if (item.kind === 'gif' || typeLabel === 'GIF') return `Insert GIF ${item.title}`;
  return item.authorName ? `Insert image by ${item.authorName}` : `Insert image ${item.title}`;
}

function getMediaCredit(item: StockMediaItem) {
  return item.authorName ? `${item.title} by ${item.authorName}` : item.title;
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
