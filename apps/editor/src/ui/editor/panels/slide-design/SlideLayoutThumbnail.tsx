import type { CSSProperties } from 'react';
import type { DesignElement, SlideLayout } from '../../../../domain/documents/model';

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

export function SlideLayoutThumbnail({ layout }: { layout: SlideLayout }) {
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
