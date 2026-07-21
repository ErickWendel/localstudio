import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { Page, ProjectDocument } from '../../../domain/documents/model';
import { pageVisibility } from '../../../domain/documents/pageVisibility';
import { MiniPagePreview } from './PageMiniPreview';

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

function getPageDisplayName(page: Page) {
  return page.visible === false ? `${page.name} (skipped)` : page.name;
}

function formatActivePageCount(count: number) {
  return `${count} active ${count === 1 ? 'page' : 'pages'}`;
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
  const pageCardRefs = useRef(new Map<string, HTMLElement>());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingPageId) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingPageId]);

  useEffect(() => {
    const activePageCard = pageCardRefs.current.get(activePageId);
    if (typeof activePageCard?.scrollIntoView !== 'function') return;
    activePageCard.scrollIntoView({
      block: 'nearest',
      behavior: 'auto',
    });
  }, [activePageId]);

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

  const activePageCount = pageVisibility.getVisiblePages(project).length;

  return (
    <aside className="pages-panel" aria-label="Pages">
      <div className="pages-panel-header">
        <div>
          <h2 className="panel-heading">Pages</h2>
          <p className="panel-muted">{formatActivePageCount(activePageCount)}</p>
        </div>
        <div className="pages-panel-header-actions ew-inline-row">
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
          const pageDisplayName = getPageDisplayName(page);
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
              aria-label={`Page ${index + 1}: ${pageDisplayName}`}
              className={className}
              data-drop-position={dropPosition}
              draggable
              key={page.id}
              ref={(element) => {
                if (element) {
                  pageCardRefs.current.set(page.id, element);
                } else {
                  pageCardRefs.current.delete(page.id);
                }
              }}
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
                style={{ aspectRatio: `${page.width} / ${page.height}` }}
                type="button"
                aria-label={`Select ${pageDisplayName}`}
                onClick={() => {
                  onSelectPage?.(page.id);
                }}
              >
                <MiniPagePreview page={page} project={project} visible={visible} />
                {visible ? null : (
                  <span className="page-card-skip-badge" aria-label="Skipped slide">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      visibility_off
                    </span>
                  </span>
                )}
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
                    aria-label={`Rename ${pageDisplayName}`}
                    onClick={() => {
                      startRename(page.id, page.name);
                    }}
                  >
                    {pageDisplayName}
                  </button>
                )}
                <div
                  className="page-card-actions ew-inline-row-tight"
                  aria-label={`${page.name} actions`}
                >
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
