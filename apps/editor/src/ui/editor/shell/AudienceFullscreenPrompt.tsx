interface AudienceFullscreenPromptProps {
  onClose: () => void;
  onEnterFullscreen: () => void;
  onStartWindowed?: (() => void) | undefined;
  mode?: 'fullscreen' | 'window';
}

export function AudienceFullscreenPrompt({
  mode = 'fullscreen',
  onClose,
  onEnterFullscreen,
  onStartWindowed,
}: AudienceFullscreenPromptProps) {
  const isWindowMode = mode === 'window';

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
          {isWindowMode
            ? 'This window is what your audience sees. Drag it to the screen your audience will be looking at and start playback in this browser window.'
            : 'This window is what your audience sees. Drag it to the screen your audience will be looking at and enter full screen mode.'}
        </p>
        <button
          className="audience-fullscreen-primary"
          type="button"
          onClick={isWindowMode ? onStartWindowed : onEnterFullscreen}
        >
          {isWindowMode ? 'Play in window' : 'Enter full screen mode'}
        </button>
      </section>
    </div>
  );
}
