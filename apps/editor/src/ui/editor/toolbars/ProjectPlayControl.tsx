export function ProjectPlayControl({
  isMenuOpen,
  onMenuOpenChange,
  onOpenPresenterView,
  onStartPresenterMode,
}: {
  isMenuOpen: boolean;
  onMenuOpenChange: (isOpen: boolean) => void;
  onOpenPresenterView?: (() => void) | undefined;
  onStartPresenterMode?: ((options?: { fromBeginning?: boolean }) => void) | undefined;
}) {
  function startPresenterMode(options?: { fromBeginning?: boolean }) {
    if (options) {
      onStartPresenterMode?.(options);
    } else {
      onStartPresenterMode?.();
    }
    onMenuOpenChange(false);
  }

  function startDefaultPresentation() {
    if (onOpenPresenterView) {
      onOpenPresenterView();
    } else {
      onStartPresenterMode?.();
    }
    onMenuOpenChange(false);
  }

  return (
    <div className="project-play-shell">
      <button
        className="project-play-button project-play-main"
        type="button"
        aria-label="Play presentation"
        data-tour-id="play-presentation"
        title="Open presenter view"
        onClick={startDefaultPresentation}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          play_arrow
        </span>
        <span>Play</span>
      </button>
      <button
        className="project-play-button project-play-menu-button"
        type="button"
        aria-expanded={isMenuOpen}
        aria-label="Presentation play options"
        title="Presentation play options"
        onClick={() => {
          onMenuOpenChange(!isMenuOpen);
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          keyboard_arrow_down
        </span>
      </button>
      {isMenuOpen ? (
        <div
          className="toolbar-dropdown project-play-dropdown"
          role="menu"
          aria-label="Presentation play menu"
        >
          <button
            className="toolbar-dropdown-item project-play-dropdown-item"
            role="menuitem"
            type="button"
            onClick={() => startPresenterMode()}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              fullscreen
            </span>
            <span>Present in fullscreen</span>
          </button>
          <button
            className="toolbar-dropdown-item project-play-dropdown-item"
            role="menuitem"
            type="button"
            onClick={() => {
              onMenuOpenChange(false);
              onOpenPresenterView?.();
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              co_present
            </span>
            <span>Presenter view</span>
          </button>
          <button
            className="toolbar-dropdown-item project-play-dropdown-item"
            role="menuitem"
            type="button"
            onClick={() => startPresenterMode({ fromBeginning: true })}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              skip_previous
            </span>
            <span>Play from beginning</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
