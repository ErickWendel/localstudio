import { useEffect, useMemo, useState } from 'react';
import type { ProjectDocument, SelectionState } from '../../domain/model';
import type { ShareService } from '../../services/interfaces';
import { CanvasWorkspace } from '../editor/CanvasWorkspace';

interface PublicDeckViewerProps {
  shareId: string;
  shareService: ShareService;
  embed?: boolean;
}

type ViewerState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; project: ProjectDocument };

export function PublicDeckViewer({ shareId, shareService, embed = false }: PublicDeckViewerProps) {
  const [viewerState, setViewerState] = useState<ViewerState>({ status: 'loading' });
  const [activePageIndex, setActivePageIndex] = useState(0);
  const emptySelection = useMemo<SelectionState>(() => ({ pageId: '', elementIds: [] }), []);

  useEffect(() => {
    let isActive = true;
    void shareService.getShare(shareId).then((record) => {
      if (!isActive) return;
      setViewerState(record ? { status: 'ready', project: record.project } : { status: 'missing' });
      setActivePageIndex(0);
    });
    return () => {
      isActive = false;
    };
  }, [shareId, shareService]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (viewerState.status !== 'ready') return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActivePageIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActivePageIndex((current) => Math.min(viewerState.project.pages.length - 1, current + 1));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewerState]);

  if (viewerState.status === 'loading') {
    return (
      <main className={embed ? 'public-deck-viewer public-deck-viewer-embed' : 'public-deck-viewer'}>
        <p className="public-deck-status">Loading deck...</p>
      </main>
    );
  }

  if (viewerState.status === 'missing') {
    return (
      <main className={embed ? 'public-deck-viewer public-deck-viewer-embed' : 'public-deck-viewer'}>
        <section className="public-deck-empty">
          <h1>Deck not found</h1>
          <p>This shared deck is unavailable or the link is incorrect.</p>
        </section>
      </main>
    );
  }

  const project = viewerState.project;
  const activePage = project.pages[activePageIndex] ?? project.pages[0];
  if (!activePage) {
    return (
      <main className={embed ? 'public-deck-viewer public-deck-viewer-embed' : 'public-deck-viewer'}>
        <section className="public-deck-empty">
          <h1>Deck could not be loaded</h1>
          <p>This shared deck does not contain any slides.</p>
        </section>
      </main>
    );
  }
  const canGoPrevious = activePageIndex > 0;
  const canGoNext = activePageIndex < project.pages.length - 1;

  return (
    <main
      className={embed ? 'public-deck-viewer public-deck-viewer-embed' : 'public-deck-viewer'}
      aria-label={embed ? 'Embedded shared deck' : 'Public shared deck'}
    >
      {!embed ? (
        <header className="public-deck-header">
          <div>
            <span className="public-deck-kicker">Public view</span>
            <h1>{project.name}</h1>
          </div>
        </header>
      ) : null}
      <section className="public-deck-stage-shell" aria-label="Shared slide preview">
        <CanvasWorkspace
          project={project}
          activePageId={activePage.id}
          selection={{ ...emptySelection, pageId: activePage.id }}
          presentationMode
          readOnly
          zoomPercent={100}
        />
      </section>
      <nav className="public-deck-controls" aria-label="Slide navigation">
        <button
          className="stitch-icon-button"
          disabled={!canGoPrevious}
          type="button"
          aria-label="Previous slide"
          onClick={() => {
            setActivePageIndex((current) => Math.max(0, current - 1));
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_left
          </span>
        </button>
        <span className="public-deck-page-count">
          {activePageIndex + 1} / {project.pages.length}
        </span>
        <button
          className="stitch-icon-button"
          disabled={!canGoNext}
          type="button"
          aria-label="Next slide"
          onClick={() => {
            setActivePageIndex((current) => Math.min(project.pages.length - 1, current + 1));
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_right
          </span>
        </button>
      </nav>
    </main>
  );
}
