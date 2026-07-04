import {
  forwardRef,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { ElementStylePatch } from '../../../domain/commands/elements/basicCommands';
import { CanvasWorkspace } from './CanvasWorkspace';
import { TextSelectionToolbar } from '../toolbars/TextSelectionToolbar';

type CanvasWorkspaceProps = ComponentProps<typeof CanvasWorkspace>;

interface ScrollingCanvasWorkspaceProps extends CanvasWorkspaceProps {
  canTranslateCurrentSlide?: boolean;
  children?: ReactNode;
  onAddPage?: ((afterPageId?: string) => void) | undefined;
  onActivePageFromScroll?: ((pageId: string) => void) | undefined;
  onDeletePage?: ((pageId: string) => void) | undefined;
  onDuplicatePage?: ((pageId: string) => void) | undefined;
  onRenamePage?: ((pageId: string, name: string) => void) | undefined;
  onReorderPage?: ((pageId: string, targetIndex: number) => void) | undefined;
  onSetPageVisibility?: ((pageId: string, visible: boolean) => void) | undefined;
  onOpenFontPanel?: (() => void) | undefined;
  onTranslatePage?: ((pageId: string) => void) | undefined;
  onUpdateElementStyle?: ((elementId: string, patch: ElementStylePatch) => void) | undefined;
  translatingPageIds?: string[] | undefined;
}

export const ScrollingCanvasWorkspace = forwardRef<HTMLDivElement, ScrollingCanvasWorkspaceProps>(
  function ScrollingCanvasWorkspace(
    {
      activePageId,
      canTranslateCurrentSlide,
      children,
      onActivePageFromScroll,
      onAddPage,
      onDeletePage,
      onDuplicatePage,
      onRenamePage,
      onReorderPage,
      onSetPageVisibility,
      onOpenFontPanel,
      onTranslatePage,
      onUpdateElementStyle,
      project,
      translatingPageIds = [],
      ...canvasProps
    },
    ref,
  ) {
    const pageRefs = useRef(new Map<string, HTMLElement>());
    const ignoreNextActiveScrollRef = useRef(false);
    const programmaticScrollReleaseRef = useRef<number | undefined>(undefined);
    const programmaticScrollRef = useRef(false);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const selectedElement = project.elements[canvasProps.selection.elementIds[0] ?? ''];
    const showTextToolbar =
      !canvasProps.presentationMode &&
      selectedElement?.type === 'text' &&
      canvasProps.selection.elementIds.length === 1;
    const textToolbarDisabled =
      Boolean(canvasProps.isTranslating) ||
      Boolean(
        selectedElement?.type === 'text' &&
        canvasProps.processingElementIds?.includes(selectedElement.id),
      );
    const showPageControls = !canvasProps.presentationMode;
    const activePageIndex = project.pages.findIndex((page) => page.id === activePageId);
    const preloadedPageIndex =
      activePageIndex === project.pages.length - 1 ? activePageIndex - 1 : activePageIndex + 1;
    useImperativeHandle(ref, () => scrollerRef.current as HTMLDivElement, []);

    useEffect(() => {
      if (ignoreNextActiveScrollRef.current) {
        ignoreNextActiveScrollRef.current = false;
        return;
      }
      const activePageElement = pageRefs.current.get(activePageId);
      if (!activePageElement?.scrollIntoView) return;
      programmaticScrollRef.current = true;
      if (programmaticScrollReleaseRef.current !== undefined) {
        window.clearTimeout(programmaticScrollReleaseRef.current);
      }
      activePageElement.scrollIntoView({ block: 'start', behavior: 'auto' });
      programmaticScrollReleaseRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = false;
        programmaticScrollReleaseRef.current = undefined;
      }, 120);
    }, [activePageId, project.pages.length]);

    useEffect(
      () => () => {
        if (programmaticScrollReleaseRef.current !== undefined) {
          window.clearTimeout(programmaticScrollReleaseRef.current);
        }
      },
      [],
    );

    function updateActivePageFromScroll() {
      if (!onActivePageFromScroll) return;
      if (programmaticScrollRef.current) return;
      const scrollerRect = scrollerRef.current?.getBoundingClientRect();
      const entries = Array.from(pageRefs.current.entries());
      if (entries.length === 0) return;
      const viewportCenter = scrollerRect
        ? scrollerRect.top + scrollerRect.height / 2
        : window.innerHeight / 2;
      const closest = entries
        .map(([pageId, element]) => {
          const rect = element.getBoundingClientRect();
          return { pageId, distance: Math.abs(rect.top + rect.height / 2 - viewportCenter) };
        })
        .sort((a, b) => a.distance - b.distance)[0];
      if (closest && closest.pageId !== activePageId) {
        ignoreNextActiveScrollRef.current = true;
        onActivePageFromScroll(closest.pageId);
      }
    }

    return (
      <div
        className="scrolling-canvas-workspace"
        aria-label="Scrollable slide canvases"
        ref={scrollerRef}
        style={{ '--canvas-zoom': `${(canvasProps.zoomPercent ?? 100) / 100}` } as CSSProperties}
        onScroll={updateActivePageFromScroll}
      >
        {showTextToolbar && selectedElement?.type === 'text' ? (
          <div className="scrolling-text-toolbar-shell" data-testid="sticky-text-selection-toolbar">
            <TextSelectionToolbar
              element={selectedElement}
              canTranslateSelection={Boolean(canvasProps.canTranslateSelection)}
              disabled={textToolbarDisabled}
              {...(canvasProps.onOpenAnimations
                ? { onOpenAnimations: canvasProps.onOpenAnimations }
                : {})}
              {...(onOpenFontPanel ? { onOpenFontPanel } : {})}
              {...(canvasProps.onTranslateSelectedText
                ? { onTranslateSelectedText: canvasProps.onTranslateSelectedText }
                : {})}
              {...(onUpdateElementStyle ? { onUpdateElementStyle } : {})}
            />
          </div>
        ) : null}
        {project.pages.map((page, index) => {
          const isActive = page.id === activePageId;
          const isTranslatingPage = translatingPageIds.includes(page.id);
          const shouldRenderCanvas = isActive || index === preloadedPageIndex;
          const visible = page.visible ?? true;
          const pageClassName = [
            'scroll-page',
            isActive ? 'scroll-page-active' : '',
            isTranslatingPage ? 'scroll-page-translating' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <section
              className={pageClassName}
              data-page-id={page.id}
              key={page.id}
              ref={(element) => {
                if (element) {
                  pageRefs.current.set(page.id, element);
                } else {
                  pageRefs.current.delete(page.id);
                }
              }}
            >
              <PageHeader
                canDelete={project.pages.length > 1}
                canMoveDown={index < project.pages.length - 1}
                canMoveUp={index > 0}
                canTranslate={Boolean(canTranslateCurrentSlide)}
                index={index}
                name={page.name}
                pageId={page.id}
                visible={visible}
                {...(onAddPage ? { onAddPage } : {})}
                {...(onDeletePage ? { onDeletePage } : {})}
                {...(onDuplicatePage ? { onDuplicatePage } : {})}
                {...(onRenamePage ? { onRenamePage } : {})}
                {...(onReorderPage ? { onReorderPage } : {})}
                {...(onSetPageVisibility ? { onSetPageVisibility } : {})}
                {...(onTranslatePage ? { onTranslatePage } : {})}
              />
              {shouldRenderCanvas ? (
                <div
                  className={isActive ? 'scroll-page-canvas-shell' : 'scroll-page-canvas-shell scroll-page-canvas-shell-preloaded'}
                  {...(!isActive ? { 'aria-hidden': true, inert: true } : {})}
                >
                  <CanvasWorkspace
                    {...canvasProps}
                    activePageId={page.id}
                    canvasLabel={isActive ? 'Slide canvas' : `Preloaded ${page.name} canvas`}
                    project={project}
                    readOnly={Boolean(canvasProps.readOnly || !isActive)}
                  />
                </div>
              ) : (
                <button
                  className={
                    visible
                      ? 'scroll-page-placeholder'
                      : 'scroll-page-placeholder scroll-page-placeholder-hidden'
                  }
                  type="button"
                  aria-label={`Activate ${page.name}`}
                  onClick={() => {
                    onActivePageFromScroll?.(page.id);
                  }}
                >
                  <span>{visible ? page.name : `${page.name} hidden`}</span>
                </button>
              )}
              {showPageControls && onAddPage ? (
                <button
                  aria-label={`Add page after ${page.name}`}
                  className="scroll-page-insert"
                  type="button"
                  onClick={() => onAddPage(page.id)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    add
                  </span>
                </button>
              ) : null}
            </section>
          );
        })}
        {children}
      </div>
    );
  },
);

interface PageHeaderProps {
  canDelete: boolean;
  canMoveDown: boolean;
  canMoveUp: boolean;
  canTranslate: boolean;
  index: number;
  name: string;
  pageId: string;
  visible: boolean;
  onAddPage?: (afterPageId?: string) => void;
  onDeletePage?: (pageId: string) => void;
  onDuplicatePage?: (pageId: string) => void;
  onRenamePage?: (pageId: string, name: string) => void;
  onReorderPage?: (pageId: string, targetIndex: number) => void;
  onSetPageVisibility?: (pageId: string, visible: boolean) => void;
  onTranslatePage?: (pageId: string) => void;
}

function PageHeader({
  canDelete,
  canMoveDown,
  canMoveUp,
  canTranslate,
  index,
  name,
  pageId,
  visible,
  onAddPage,
  onDeletePage,
  onDuplicatePage,
  onRenamePage,
  onReorderPage,
  onSetPageVisibility,
  onTranslatePage,
}: PageHeaderProps) {
  return (
    <header className="scroll-page-header">
      <button
        className="scroll-page-title"
        type="button"
        aria-label={`Rename ${name}`}
        onClick={() => {
          const nextName = window.prompt('Page title', name);
          if (nextName) onRenamePage?.(pageId, nextName);
        }}
      >
        Page {index + 1} - {name}
      </button>
      <div className="scroll-page-actions" aria-label={`${name} page actions`}>
        <IconAction
          disabled={!canMoveUp}
          label={`Move ${name} up`}
          icon="keyboard_arrow_up"
          onClick={() => onReorderPage?.(pageId, index - 1)}
        />
        <IconAction
          disabled={!canMoveDown}
          label={`Move ${name} down`}
          icon="keyboard_arrow_down"
          onClick={() => onReorderPage?.(pageId, index + 1)}
        />
        <IconAction
          label={visible ? `Hide ${name}` : `Show ${name}`}
          icon={visible ? 'visibility_off' : 'visibility'}
          onClick={() => onSetPageVisibility?.(pageId, !visible)}
        />
        <IconAction
          label={`Duplicate ${name}`}
          icon="content_copy"
          onClick={() => onDuplicatePage?.(pageId)}
        />
        <IconAction
          disabled={!canTranslate}
          label={`Translate ${name}`}
          icon="translate"
          onClick={() => onTranslatePage?.(pageId)}
        />
        <IconAction
          disabled={!canDelete}
          label={`Delete ${name}`}
          icon="delete"
          danger
          onClick={() => onDeletePage?.(pageId)}
        />
        <IconAction
          label="Add page"
          icon="add"
          {...(onAddPage ? { onClick: () => onAddPage(pageId) } : {})}
        />
      </div>
    </header>
  );
}

function IconAction({
  danger,
  disabled,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={danger ? 'icon-button icon-button-danger' : 'icon-button'}
      disabled={disabled}
      title={label}
      type="button"
      aria-label={label}
      onClick={onClick}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
