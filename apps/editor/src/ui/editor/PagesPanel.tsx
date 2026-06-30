import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { DesignElement, Page, ProjectDocument } from '../../domain/model';

type DropPosition = 'before' | 'after';

interface PagesPanelProps {
  activePageId: string;
  canTranslate?: boolean;
  project: ProjectDocument;
  onAddPage?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  onDeletePage?: ((pageId: string) => void) | undefined;
  onDuplicatePage?: ((pageId: string) => void) | undefined;
  onRenamePage?: ((pageId: string, name: string) => void) | undefined;
  onReorderPage?: ((pageId: string, targetIndex: number) => void) | undefined;
  onSelectPage?: ((pageId: string) => void) | undefined;
  onSetPageVisibility?: ((pageId: string, visible: boolean) => void) | undefined;
  onTranslatePage?: ((pageId: string) => void) | undefined;
}

export function PagesPanel({
  activePageId,
  canTranslate = false,
  project,
  onAddPage,
  onClose,
  onDeletePage,
  onDuplicatePage,
  onRenamePage,
  onReorderPage,
  onSelectPage,
  onSetPageVisibility,
  onTranslatePage,
}: PagesPanelProps) {
  const [editingPageId, setEditingPageId] = useState<string | undefined>();
  const [dropIndicator, setDropIndicator] = useState<{ pageId: string; position: DropPosition } | undefined>();
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

  function handleDragStart(event: DragEvent<HTMLElement>, pageId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-localstudio-page-id', pageId);
  }

  function getDropPosition(event: DragEvent<HTMLElement>): DropPosition {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }

  function handleDragOver(event: DragEvent<HTMLElement>, pageId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropIndicator({ pageId, position: getDropPosition(event) });
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetPageId: string) {
    event.preventDefault();
    const position = getDropPosition(event);
    setDropIndicator(undefined);
    const pageId = event.dataTransfer.getData('application/x-localstudio-page-id');
    if (!pageId || pageId === targetPageId) return;
    const currentIndex = project.pages.findIndex((page) => page.id === pageId);
    if (currentIndex === -1) return;
    const pagesWithoutDragged = project.pages.filter((page) => page.id !== pageId);
    const targetIndex = pagesWithoutDragged.findIndex((page) => page.id === targetPageId);
    if (targetIndex === -1) return;
    onReorderPage?.(pageId, position === 'after' ? targetIndex + 1 : targetIndex);
  }

  return (
    <aside className="pages-panel" aria-label="Pages">
      <div className="pages-panel-header">
        <div>
          <h2 className="panel-heading">Pages</h2>
          <p className="panel-muted">{project.pages.length} pages</p>
        </div>
        <div className="pages-panel-header-actions">
          <button className="icon-button" type="button" aria-label="Add page" title="Add page" onClick={onAddPage}>
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
          </button>
          <button className="icon-button" type="button" aria-label="Close pages panel" title="Close pages panel" onClick={onClose}>
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      </div>
      <div className="pages-list">
        {project.pages.map((page, index) => {
          const visible = page.visible ?? true;
          const isActive = page.id === activePageId;
          const dropPosition = dropIndicator?.pageId === page.id ? dropIndicator.position : undefined;
          const className = [
            'page-card',
            isActive ? 'page-card-active' : '',
            dropPosition === 'before' ? 'drop-indicator-before' : '',
            dropPosition === 'after' ? 'drop-indicator-after' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <article
              aria-label={`Page ${index + 1}: ${page.name}`}
              className={className}
              data-drop-position={dropPosition}
              draggable
              key={page.id}
              onDragEnd={() => setDropIndicator(undefined)}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setDropIndicator((current) => (current?.pageId === page.id ? undefined : current));
              }}
              onDragOver={(event) => {
                handleDragOver(event, page.id);
              }}
              onDragStart={(event) => {
                handleDragStart(event, page.id);
              }}
              onDrop={(event) => {
                handleDrop(event, page.id);
              }}
            >
              <span className="page-card-number" aria-hidden="true">
                {index + 1}
              </span>
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
