import { NotebookText } from 'lucide-react';
import type {
  PresenterRemoteSlidePreview,
  PresenterRemoteSlidePreviewElement,
} from '@localstudio/presenter-remote/protocol';

function getElementStyle(
  element: PresenterRemoteSlidePreviewElement,
  preview: PresenterRemoteSlidePreview,
) {
  return {
    height: `${(element.height / preview.height) * 100}%`,
    left: `${(element.x / preview.width) * 100}%`,
    opacity: element.opacity,
    top: `${(element.y / preview.height) * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
    width: `${(element.width / preview.width) * 100}%`,
  };
}

export function SlideCanvas({
  compact = false,
  preview,
  renderMediaAssets = true,
}: {
  compact?: boolean;
  preview: PresenterRemoteSlidePreview | undefined;
  renderMediaAssets?: boolean;
}) {
  if (!preview) {
    return (
      <span
        className={
          compact
            ? 'joystick-slide-canvas joystick-slide-canvas-empty joystick-slide-canvas-compact'
            : 'joystick-slide-canvas joystick-slide-canvas-empty'
        }
      >
        <NotebookText size={compact ? 24 : 38} />
      </span>
    );
  }

  return (
    <span
      className={
        compact ? 'joystick-slide-canvas joystick-slide-canvas-compact' : 'joystick-slide-canvas'
      }
      style={{
        aspectRatio: `${preview.width} / ${preview.height}`,
        backgroundColor: preview.backgroundColor,
      }}
    >
      {preview.backgroundImageUrl ? (
        <img alt="" className="joystick-slide-bg" src={preview.backgroundImageUrl} />
      ) : null}
      {preview.elements.map((element) => {
        const style = getElementStyle(element, preview);
        if (element.kind === 'image') {
          if (!element.assetUrl) return null;
          return (
            <img
              alt=""
              className="joystick-slide-element joystick-slide-image"
              key={element.id}
              src={element.assetUrl}
              style={style}
            />
          );
        }
        if (element.kind === 'media') {
          if (renderMediaAssets && element.assetUrl && element.mediaType === 'gif') {
            return (
              <img
                alt=""
                className="joystick-slide-element joystick-slide-image"
                key={element.id}
                src={element.assetUrl}
                style={style}
              />
            );
          }
          if (renderMediaAssets && element.assetUrl && element.mediaType === 'video') {
            return (
              <video
                aria-label="Slide video"
                autoPlay={element.autoplay}
                className="joystick-slide-element joystick-slide-video"
                key={element.id}
                loop={element.loop}
                muted={element.muted}
                playsInline
                src={element.assetUrl}
                style={style}
              />
            );
          }
          return (
            <span
              className="joystick-slide-element joystick-slide-media"
              key={element.id}
              style={style}
            >
              <span aria-hidden="true">play_arrow</span>
            </span>
          );
        }
        if (element.kind === 'text') {
          if (element.hyperlink) {
            return (
              <a
                aria-label={`Open ${element.text}`}
                className="joystick-slide-element joystick-slide-text"
                href={element.hyperlink}
                key={element.id}
                rel="noreferrer"
                style={{
                  ...style,
                  alignItems:
                    element.verticalAlign === 'bottom'
                      ? 'flex-end'
                      : element.verticalAlign === 'middle'
                        ? 'center'
                        : 'flex-start',
                  color: element.fill,
                  fontFamily: element.fontFamily,
                  fontSize: `${Math.max(compact ? 3 : 5, (element.fontSize / preview.width) * 100)}cqw`,
                  fontWeight: element.fontWeight,
                  justifyContent:
                    element.align === 'right'
                      ? 'flex-end'
                      : element.align === 'center'
                        ? 'center'
                        : 'flex-start',
                  lineHeight: element.lineHeight ?? 1.05,
                  textAlign: element.align,
                  textDecoration: 'underline',
                }}
                target="_blank"
              >
                {element.text}
              </a>
            );
          }
          return (
            <span
              className="joystick-slide-element joystick-slide-text"
              key={element.id}
              style={{
                ...style,
                alignItems:
                  element.verticalAlign === 'bottom'
                    ? 'flex-end'
                    : element.verticalAlign === 'middle'
                      ? 'center'
                      : 'flex-start',
                color: element.fill,
                fontFamily: element.fontFamily,
                fontSize: `${Math.max(compact ? 3 : 5, (element.fontSize / preview.width) * 100)}cqw`,
                fontWeight: element.fontWeight,
                justifyContent:
                  element.align === 'right'
                    ? 'flex-end'
                    : element.align === 'center'
                      ? 'center'
                      : 'flex-start',
                lineHeight: element.lineHeight ?? 1.05,
                textAlign: element.align,
              }}
            >
              {element.text}
            </span>
          );
        }
        if (element.kind !== 'shape') return null;
        return (
          <span
            className={`joystick-slide-element joystick-slide-shape joystick-slide-shape-${element.shape}`}
            key={element.id}
            style={{
              ...style,
              backgroundColor: element.fill ?? 'transparent',
              borderColor: element.stroke,
              borderWidth: element.strokeWidth,
            }}
          />
        );
      })}
    </span>
  );
}
