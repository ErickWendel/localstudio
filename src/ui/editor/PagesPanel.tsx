import { useEffect, useRef, useState } from 'react';
import type { DesignElement, Page, ProjectDocument } from '../../domain/model';

interface PagesPanelProps {
  activePageId: string;
  canTranslate?: boolean;
  project: ProjectDocument;
  onAddPage?: () => void;
  onDeletePage?: (pageId: string) => void;
  onDuplicatePage?: (pageId: string) => void;
  onRenamePage?: (pageId: string, name: string) => void;
  onReorderPage?: (pageId: string, targetIndex: number) => void;
  onSelectPage?: (pageId: string) => void;
  onSetPageVisibility?: (pageId: string, visible: boolean) => void;
  onTranslatePage?: (pageId: string) => void;
}

export function PagesPanel({
  activePageId,
  canTranslate = false,
  project,
  onAddPage,
  onDeletePage,
  onDuplicatePage,
  onRenamePage,
  onReorderPage,
  onSelectPage,
  onSetPageVisibility,
  onTranslatePage,
}: PagesPanelProps) {
  const [editingPageId, setEditingPageId] = useState<string | undefined>();
  const [draftName, setDraftName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingPageId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingPageId]);

  function startRename(pageId: string, name: string) {
    setEditingPageId(pageId);
    setDraftName(name);
  }

  function commitRename() {
    if (!editingPageId) return;
    onRenamePage?.(editingPageId, draftName);
    setEditingPageId(undefined);
  }

  return (
    <aside className="pages-panel" aria-label="Pages">
      <div className="pages-panel-header">
        <div>
          <h2 className="panel-heading">Pages</h2>
          <p className="panel-muted">{project.pages.length} pages</p>
        </div>
        <button className="icon-button" type="button" aria-label="Add page" title="Add page" onClick={onAddPage}>
          <span className="material-symbols-outlined" aria-hidden="true">
            add
          </span>
        </button>
      </div>
      <div className="pages-list">
        {project.pages.map((page, index) => {
          const visible = page.visible ?? true;
          const isActive = page.id === activePageId;
          return (
            <article
              aria-label={`Page ${index + 1}: ${page.name}`}
              className={isActive ? 'page-card page-card-active' : 'page-card'}
              key={page.id}
            >
              <button
                className="page-card-preview"
                type="button"
                aria-label={`Select ${page.name}`}
                onClick={() => {
                  onSelectPage?.(page.id);
                }}
              >
                <MiniPagePreview page={page} project={project} visible={visible} />
              </button>
              <div className="page-card-body">
                <span className="page-card-index">Page {index + 1}</span>
                {editingPageId === page.id ? (
                  <input
                    ref={inputRef}
                    aria-label={`Page ${index + 1} title`}
                    className="page-title-input"
                    value={draftName}
                    onBlur={commitRename}
                    onChange={(event) => {
                      setDraftName(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setEditingPageId(undefined);
                      if (event.key === 'Enter') commitRename();
                    }}
                  />
                ) : (
                  <button
                    className="page-title-button"
                    type="button"
                    aria-label={`Rename ${page.name}`}
                    onClick={() => {
                      startRename(page.id, page.name);
                    }}
                  >
                    {page.name}
                  </button>
                )}
                <div className="page-card-actions" aria-label={`${page.name} actions`}>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Move ${page.name} up`}
                    disabled={index === 0}
                    onClick={() => {
                      onReorderPage?.(page.id, index - 1);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      keyboard_arrow_up
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Move ${page.name} down`}
                    disabled={index === project.pages.length - 1}
                    onClick={() => {
                      onReorderPage?.(page.id, index + 1);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      keyboard_arrow_down
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={visible ? `Hide ${page.name}` : `Show ${page.name}`}
                    onClick={() => {
                      onSetPageVisibility?.(page.id, !visible);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {visible ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Duplicate ${page.name}`}
                    onClick={() => {
                      onDuplicatePage?.(page.id);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      content_copy
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Translate ${page.name}`}
                    disabled={!canTranslate}
                    onClick={() => {
                      onTranslatePage?.(page.id);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      translate
                    </span>
                  </button>
                  <button
                    className="icon-button icon-button-danger"
                    type="button"
                    aria-label={`Delete ${page.name}`}
                    disabled={project.pages.length <= 1}
                    onClick={() => {
                      onDeletePage?.(page.id);
                    }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function MiniPagePreview({
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
        <img alt="" className="page-card-bg-image" src={project.assets[page.background.assetId]?.objectUrl} />
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
    return asset?.objectUrl ? (
      <img alt="" className="page-card-mini-element" src={asset.objectUrl} style={style} />
    ) : (
      <span className="page-card-mini-element page-card-mini-placeholder" style={style} />
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
          fontSize: `${Math.max(4, (element.fontSize / page.height) * 100)}cqw`,
          fontWeight: element.fontWeight,
          textAlign: element.align,
        }}
      >
        {element.text}
      </span>
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
