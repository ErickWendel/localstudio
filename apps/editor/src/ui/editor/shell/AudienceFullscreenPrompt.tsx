interface AudienceFullscreenPromptProps {
  onClose: () => void;
  onEnterFullscreen: () => void;
}

export function AudienceFullscreenPrompt({
  onClose,
  onEnterFullscreen,
}: AudienceFullscreenPromptProps) {
  return (
    <div className="audience-fullscreen-backdrop" role="presentation">
      <section
        className="audience-fullscreen-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audience-fullscreen-title"
      >
        <button
          className="audience-fullscreen-close"
          type="button"
          aria-label="Close audience fullscreen prompt"
          onClick={onClose}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            close
          </span>
        </button>
        <h2 id="audience-fullscreen-title">Audience Window</h2>
        <p>
          This window is what your audience sees. Drag it to the screen your audience will be
          looking at and enter full screen mode.
        </p>
        <button className="audience-fullscreen-primary" type="button" onClick={onEnterFullscreen}>
          Enter full screen mode
        </button>
      </section>
    </div>
  );
}
