import type { DesignElement, Page, ProjectDocument } from '../../../domain/documents/model';

export function MiniPagePreview({
  page,
  project,
  visible,
}: {
  page: Page;
  project: ProjectDocument;
  visible: boolean;
}) {
  const background =
    page.background.type === 'color'
      ? page.background.color
      : (project.assets[page.background.assetId]?.objectUrl ?? page.background.colorFallback);

  return (
    <span
      className={visible ? 'page-card-canvas' : 'page-card-canvas page-card-canvas-hidden'}
      style={{ backgroundColor: page.background.type === 'color' ? background : page.background.colorFallback }}
    >
      {page.background.type === 'asset' && project.assets[page.background.assetId]?.objectUrl ? (
        <img
          alt=""
          className="page-card-bg-image ew-fill-media"
          src={project.assets[page.background.assetId]?.objectUrl}
        />
      ) : null}
      {page.elementIds.map((elementId) => {
        const element = project.elements[elementId];
        if (!element || element.visible === false) return null;
        return <MiniElement element={element} key={element.id} page={page} project={project} />;
      })}
    </span>
  );
}

function MiniElement({
  element,
  page,
  project,
}: {
  element: DesignElement;
  page: Page;
  project: ProjectDocument;
}) {
  const style = {
    height: `${(element.height / page.height) * 100}%`,
    left: `${(element.x / page.width) * 100}%`,
    opacity: element.opacity,
    top: `${(element.y / page.height) * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
    width: `${(element.width / page.width) * 100}%`,
  };

  if (element.type === 'image') {
    const asset = project.assets[element.assetId];
    const imageStyle = element.crop
      ? {
          ...style,
          objectPosition: `${(element.crop.x + element.crop.width / 2) * 100}% ${
            (element.crop.y + element.crop.height / 2) * 100
          }%`,
        }
      : style;
    return asset?.objectUrl ? (
      <img alt="" className="page-card-mini-element" src={asset.objectUrl} style={imageStyle} />
    ) : (
      <span className="page-card-mini-element page-card-mini-placeholder" style={imageStyle} />
    );
  }

  if (element.type === 'text') {
    return (
      <span
        className="page-card-mini-element page-card-mini-text"
        style={{
          ...style,
          color: element.fill,
          fontFamily: element.fontFamily,
          fontSize: `${Math.max(4, (element.fontSize / page.width) * 100)}cqw`,
          fontWeight: element.fontWeight,
          lineHeight: 0.9,
          overflow: 'visible',
          textAlign: element.align,
          whiteSpace: 'pre-wrap',
        }}
      >
        {element.text}
      </span>
    );
  }

  if (element.type === 'gif') {
    const asset = project.assets[element.assetId];
    return asset?.objectUrl ? (
      <img alt="" className="page-card-mini-element" src={asset.objectUrl} style={style} />
    ) : (
      <span className="page-card-mini-element page-card-mini-placeholder" style={style} />
    );
  }

  if (element.type === 'video') {
    const asset = project.assets[element.assetId];
    return asset?.objectUrl ? (
      <video className="page-card-mini-element" muted playsInline preload="metadata" src={asset.objectUrl} style={style} />
    ) : (
      <span className="page-card-mini-element page-card-mini-placeholder" style={style} />
    );
  }

  return (
    <span
      className="page-card-mini-element"
      style={{
        ...style,
        backgroundColor: element.fill,
        border: element.stroke ? `1px solid ${element.stroke}` : undefined,
        borderRadius: element.shape === 'ellipse' ? '50%' : '2px',
      }}
    />
  );
}
