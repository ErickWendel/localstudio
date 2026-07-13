export function EditorMobileUnavailable() {
  return (
    <main className="editor-mobile-unavailable" aria-labelledby="editor-mobile-unavailable-title">
      <div className="editor-mobile-unavailable__plate" aria-hidden="true">
        <div className="editor-mobile-unavailable__browser">
          <span />
          <span />
          <span />
        </div>
        <div className="editor-mobile-unavailable__canvas">
          <div className="editor-mobile-unavailable__slide">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="editor-mobile-unavailable__phone">
          <div className="editor-mobile-unavailable__phone-notch" />
          <div className="editor-mobile-unavailable__phone-line" />
          <strong>Desktop required</strong>
        </div>
      </div>
      <section className="editor-mobile-unavailable__copy">
        <p className="editor-mobile-unavailable__eyebrow">LocalStudio editor</p>
        <h1 id="editor-mobile-unavailable-title">Open this workspace on a desktop screen.</h1>
        <p>
          The editor is built for precise slide layout, file access, keyboard shortcuts, and wide
          tool panels. Mobile editing is disabled so work does not open in a cramped or unstable
          view.
        </p>
        <a className="editor-mobile-unavailable__link" href="/">
          Go to LocalStudio
        </a>
      </section>
    </main>
  );
}
