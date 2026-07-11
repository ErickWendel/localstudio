import type { CSSProperties } from 'react';
import type { DesignElement, Page, ProjectDocument } from '../../domain/documents/model';

function getElementStyle(element: DesignElement, page: Page): CSSProperties {
  return {
    height: `${(element.height / page.height) * 100}%`,
    left: `${(element.x / page.width) * 100}%`,
    opacity: element.opacity,
    top: `${(element.y / page.height) * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
    width: `${(element.width / page.width) * 100}%`,
  };
}

export function PresenterThumbnail({ page, project }: { page: Page; project: ProjectDocument }) {
  const background =
    page.background.type === 'color'
      ? page.background.color
      : (project.assets[page.background.assetId]?.objectUrl ?? page.background.colorFallback);

  return (
    <span
      className="presenter-thumb-canvas"
      style={{
        aspectRatio: `${page.width} / ${page.height}`,
        backgroundColor: page.background.type === 'color' ? background : page.background.colorFallback,
      }}
    >
      {page.background.type === 'asset' && project.assets[page.background.assetId]?.objectUrl ? (
        <img
          alt=""
          className="presenter-thumb-bg ew-fill-media"
          src={project.assets[page.background.assetId]?.objectUrl}
        />
      ) : null}
      {page.elementIds.map((elementId) => {
        const element = project.elements[elementId];
        if (!element || element.visible === false) return null;
        const style = getElementStyle(element, page);
        if (element.type === 'image') {
          const asset = project.assets[element.assetId];
          return asset?.objectUrl ? (
            <img alt="" className="presenter-thumb-element" key={element.id} src={asset.objectUrl} style={style} />
          ) : null;
        }
        if (element.type === 'text') {
          return (
            <span
              className="presenter-thumb-element presenter-thumb-text"
              key={element.id}
              style={{
                ...style,
                color: element.fill,
                fontFamily: element.fontFamily,
                fontSize: `${Math.max(4, (element.fontSize / page.width) * 100)}cqw`,
                fontWeight: element.fontWeight,
                textAlign: element.align,
              }}
            >
              {element.text}
            </span>
          );
        }
        return <span className="presenter-thumb-element" key={element.id} style={style} />;
      })}
    </span>
  );
}
