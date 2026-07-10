import { ChevronDown } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type {
  DesignElement,
  PageBackground,
  ProjectDocument,
  SlideLayout,
} from '../../../domain/documents/model';
import { PanelSection } from '../../components/PanelSection';
import { DesignColorField } from './design-controls/DesignColorField';
import { DesignSelectField } from './design-controls/DesignSelectField';

const slideFillTypeOptions = [{ value: 'color', label: 'Color fill' }] as const;

function getBackgroundColor(background: PageBackground) {
  return background.type === 'color' ? background.color : background.colorFallback;
}

function getSlideLayoutOptions(project: ProjectDocument) {
  return Object.values(project.slideLayouts ?? {});
}

function SlideLayoutChooser({
  activeLayoutId,
  layouts,
  pageId,
  onApplySlideLayout,
}: {
  activeLayoutId?: string | undefined;
  layouts: SlideLayout[];
  pageId?: string | undefined;
  onApplySlideLayout: (pageId: string, layoutId: string) => void;
}) {
  return (
    <div className="template-chooser-shelf" aria-label="Choose a layout" role="region">
      <div className="template-chooser-title">Choose a layout</div>
      {layouts.length > 0 ? (
        <div className="layout-choice-grid">
          {layouts.map((layout) => (
            <button
              aria-current={layout.id === activeLayoutId ? 'true' : undefined}
              className={
                layout.id === activeLayoutId
                  ? 'layout-choice-card layout-choice-card-active'
                  : 'layout-choice-card'
              }
              disabled={!pageId}
              key={layout.id}
              type="button"
              onClick={() => {
                if (pageId) onApplySlideLayout(pageId, layout.id);
              }}
            >
              <LayoutChoiceThumbnail layout={layout} />
              <span>{layout.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="template-chooser-empty">No imported layouts yet.</p>
      )}
    </div>
  );
}

function LayoutChoiceThumbnail({ layout }: { layout: SlideLayout }) {
  const elements = layout.elementIds
    .map((elementId) => layout.elements[elementId])
    .filter((element): element is DesignElement => Boolean(element))
    .filter((element) => element.visible !== false);
  if (elements.length > 0) {
    const bounds = getLayoutThumbnailBounds(elements);
    return (
      <span
        className="layout-choice-thumbnail"
        aria-hidden="true"
        style={getLayoutThumbnailStyle(layout)}
      >
        {elements.map((element) => (
          <LayoutChoiceElement element={element} key={element.id} bounds={bounds} />
        ))}
      </span>
    );
  }
  const roles = new Set(layout.placeholderRoles);
  return (
    <span
      className="layout-choice-thumbnail"
      aria-hidden="true"
      style={getLayoutThumbnailStyle(layout)}
    >
      {roles.has('title') ? <span className="layout-choice-title" /> : null}
      {roles.has('body') ? <span className="layout-choice-body" /> : null}
      {roles.has('footer') ? <span className="layout-choice-footer" /> : null}
      {roles.has('slideNumber') ? <span className="layout-choice-number" /> : null}
      {roles.size === 0 ? <span className="layout-choice-blank" /> : null}
    </span>
  );
}

function getLayoutPreviewInk(backgroundColor: string) {
  const normalized = backgroundColor.replace('#', '');
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized;
  const red = Number.parseInt(fullHex.slice(0, 2), 16);
  const green = Number.parseInt(fullHex.slice(2, 4), 16);
  const blue = Number.parseInt(fullHex.slice(4, 6), 16);
  if (![red, green, blue].every(Number.isFinite)) return '#182124';
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? '#1E2528' : '#F5F7F3';
}

function getLayoutThumbnailStyle(layout: SlideLayout): CSSProperties {
  const background = layout.background.type === 'color' ? layout.background.color : '#F8FAF7';
  return {
    '--layout-preview-background': background,
    '--layout-preview-ink': getLayoutPreviewInk(background),
  } as CSSProperties;
}

function getLayoutThumbnailBounds(elements: DesignElement[]) {
  const xValues = elements.flatMap((element) => [element.x, element.x + element.width]);
  const yValues = elements.flatMap((element) => [element.y, element.y + element.height]);
  const minX = Math.min(...xValues, 0);
  const minY = Math.min(...yValues, 0);
  const maxX = Math.max(...xValues, 1920);
  const maxY = Math.max(...yValues, 1080);
  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function getLayoutElementStyle(
  element: DesignElement,
  bounds: ReturnType<typeof getLayoutThumbnailBounds>,
): CSSProperties {
  return {
    left: `${((element.x - bounds.minX) / bounds.width) * 100}%`,
    top: `${((element.y - bounds.minY) / bounds.height) * 100}%`,
    width: `${(element.width / bounds.width) * 100}%`,
    height: `${(element.height / bounds.height) * 100}%`,
    opacity: element.opacity,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
  };
}

function LayoutChoiceElement({
  bounds,
  element,
}: {
  bounds: ReturnType<typeof getLayoutThumbnailBounds>;
  element: DesignElement;
}) {
  const style = getLayoutElementStyle(element, bounds);
  if (element.type === 'text') {
    const roleClass = element.placeholderRole
      ? ` layout-choice-placeholder layout-choice-placeholder-${element.placeholderRole}`
      : ' layout-choice-text-run';
    return (
      <span
        className={`layout-choice-element layout-choice-text${roleClass}`}
        style={{
          ...style,
          justifyContent:
            element.align === 'center'
              ? 'center'
              : element.align === 'right'
                ? 'flex-end'
                : 'flex-start',
        }}
      />
    );
  }
  if (element.type === 'shape') {
    return (
      <span
        className={`layout-choice-element layout-choice-shape layout-choice-shape-${element.shape}`}
        style={{
          ...style,
          background: element.fill ?? 'transparent',
          borderColor: element.stroke ?? element.fill ?? '#050D10',
          borderWidth: element.strokeWidth ? 1 : 0,
        }}
      />
    );
  }
  return <span className="layout-choice-element layout-choice-media" style={style} />;
}

export function SlideDesignPanel({
  page,
  project,
  onApplySlideLayout,
  onEditSlideLayout,
  onToggleSlideLayoutPlaceholder,
  onUpdatePageBackground,
}: {
  page?: ProjectDocument['pages'][number] | undefined;
  project: ProjectDocument;
  onApplySlideLayout: ((pageId: string, layoutId: string) => void) | undefined;
  onEditSlideLayout: ((layoutId: string) => void) | undefined;
  onToggleSlideLayoutPlaceholder:
    | ((
        layoutId: string,
        role: 'body' | 'footer' | 'slideNumber' | 'title',
        visible: boolean,
      ) => void)
    | undefined;
  onUpdatePageBackground: ((background: PageBackground) => void) | undefined;
}) {
  const layout = page?.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
  const layoutOptions = getSlideLayoutOptions(project);
  const [layoutPickerOpen, setLayoutPickerOpen] = useState(false);
  const layoutId = layout?.id ?? layoutOptions[0]?.id;
  const layoutName = layout?.name ?? 'Blank';
  const backgroundColor = page ? getBackgroundColor(page.background) : '#050D10';
  const visibility = layout?.placeholderVisibility ?? {
    body: true,
    footer: true,
    slideNumber: true,
    title: true,
  };
  return (
    <div className="panel-stack">
      <PanelSection title="Slide">
        <button
          aria-expanded={layoutPickerOpen}
          aria-label={`Open layout picker, current layout ${layoutName}`}
          className="template-preview-card template-preview-card-slide template-preview-button"
          type="button"
          onClick={() => setLayoutPickerOpen((current) => !current)}
        >
          <div className="template-slide-thumbnail" aria-hidden="true">
            <span className="template-slide-title" />
            <span className="template-slide-body" />
            <span className="template-slide-footer" />
          </div>
          <div className="template-preview-copy">
            <span>Slide layout</span>
            <strong>{layoutName}</strong>
          </div>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {layoutPickerOpen ? (
          <SlideLayoutChooser
            activeLayoutId={layout?.id}
            layouts={layoutOptions}
            pageId={page?.id}
            onApplySlideLayout={(pageId, nextLayoutId) => {
              onApplySlideLayout?.(pageId, nextLayoutId);
              setLayoutPickerOpen(false);
            }}
          />
        ) : null}
        <div className="template-action-row">
          <button
            type="button"
            disabled={!layoutId}
            onClick={() => layoutId && onEditSlideLayout?.(layoutId)}
          >
            Edit layout
          </button>
          <button
            type="button"
            disabled={!layoutId || !page}
            onClick={() => page && layoutId && onApplySlideLayout?.(page.id, layoutId)}
          >
            Apply layout
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Appearance">
        {(
          [
            ['title', 'Title'],
            ['body', 'Body'],
            ['footer', 'Footer'],
            ['slideNumber', 'Slide number'],
          ] as const
        ).map(([role, label]) => (
          <label className="template-checkbox-row" key={role}>
            <input
              checked={visibility[role]}
              disabled={!layoutId}
              type="checkbox"
              onChange={(event) => {
                if (layoutId) onToggleSlideLayoutPlaceholder?.(layoutId, role, event.target.checked);
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </PanelSection>

      <PanelSection title="Background">
        <div className="template-segmented-control" role="group" aria-label="Background mode">
          <button className="template-segmented-active" type="button">
            Standard
          </button>
          <button type="button">Dynamic</button>
        </div>
        <DesignColorField
          ariaLabel="Slide background color"
          label="Current fill"
          value={backgroundColor}
          onChange={(color) => {
            onUpdatePageBackground?.({ type: 'color', color });
          }}
        />
        <DesignSelectField
          ariaLabel="Slide fill type"
          defaultValue="color"
          label="Fill type"
          options={slideFillTypeOptions}
        />
      </PanelSection>
    </div>
  );
}
