interface EditorFooterProps {
  activePageIndex: number;
  isFullscreen?: boolean;
  pageCount: number;
  pagesPanelOpen?: boolean;
  zoomPercent: number;
  onResetZoom?: () => void;
  onToggleFullscreen?: () => void;
  onTogglePagesPanel?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export function EditorFooter({
  activePageIndex,
  isFullscreen = false,
  pageCount,
  pagesPanelOpen = true,
  zoomPercent,
  onResetZoom,
  onToggleFullscreen,
  onTogglePagesPanel,
  onZoomIn,
  onZoomOut,
}: EditorFooterProps) {
  return (
    <footer className="editor-footer" aria-label="Editor footer controls">
      <div className="editor-footer-left">
        <span className="footer-note">
          <span className="material-symbols-outlined" aria-hidden="true">
            edit_note
          </span>
          Notes
        </span>
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
          <button className="zoom-value" type="button" aria-label="Reset zoom" onClick={onResetZoom}>
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
          onClick={onTogglePagesPanel}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            view_sidebar
          </span>
          Pages
        </button>
        <span className="footer-page-count">
          {activePageIndex + 1} / {pageCount}
        </span>
        <button
          className={isFullscreen ? 'footer-toggle footer-toggle-active' : 'footer-toggle'}
          type="button"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={onToggleFullscreen}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
          </span>
        </button>
      </div>
    </footer>
  );
}
