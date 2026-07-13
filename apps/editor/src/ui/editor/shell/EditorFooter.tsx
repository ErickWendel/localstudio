interface EditorFooterProps {
  activePageIndex: number;
  notesOpen?: boolean;
  pageCount: number;
  pagesPanelOpen?: boolean;
  zoomPercent: number;
  onToggleNotes?: () => void;
  onOpenSettings?: () => void;
  onResetZoom?: () => void;
  onTogglePagesPanel?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export function EditorFooter({
  activePageIndex,
  notesOpen = false,
  pageCount,
  pagesPanelOpen = true,
  zoomPercent,
  onToggleNotes,
  onOpenSettings,
  onResetZoom,
  onTogglePagesPanel,
  onZoomIn,
  onZoomOut,
}: EditorFooterProps) {
  const activePageNumber = pageCount === 0 ? 0 : activePageIndex + 1;

  return (
    <footer className="editor-footer" aria-label="Editor footer controls">
      <div className="editor-footer-left">
        <button
          className="stitch-icon-button footer-settings-button"
          type="button"
          aria-label="Mirror settings"
          title="Mirror settings"
          data-tour-id="footer-settings"
          onClick={onOpenSettings}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            settings
          </span>
        </button>
        <button
          className={notesOpen ? 'footer-toggle footer-toggle-active' : 'footer-toggle'}
          type="button"
          aria-label="Toggle notes panel"
          aria-pressed={notesOpen}
          data-tour-id="speaker-notes-toggle"
          onClick={onToggleNotes}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            edit_note
          </span>
          Notes
        </button>
      </div>
      <div className="editor-footer-right">
        <div className="footer-zoom-controls" aria-label="Zoom controls">
          <button
            className="stitch-icon-button"
            disabled={zoomPercent <= 50}
            type="button"
            aria-label="Zoom Out"
            onClick={onZoomOut}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              remove
            </span>
          </button>
          <button
            className="zoom-value"
            type="button"
            aria-label="Reset zoom"
            onClick={onResetZoom}
          >
            {zoomPercent}%
          </button>
          <button
            className="stitch-icon-button"
            disabled={zoomPercent >= 200}
            type="button"
            aria-label="Zoom In"
            onClick={onZoomIn}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
          </button>
        </div>
        <button
          className={pagesPanelOpen ? 'footer-toggle footer-toggle-active' : 'footer-toggle'}
          type="button"
          aria-label="Toggle pages panel"
          data-tour-id="pages-panel-toggle"
          onClick={onTogglePagesPanel}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            view_sidebar
          </span>
          Pages
        </button>
        <span className="footer-page-count">
          {activePageNumber} / {pageCount}
        </span>
      </div>
    </footer>
  );
}
