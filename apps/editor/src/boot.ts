const editorMobileViewportQuery = '(max-width: 760px)';

function isEditorMobileFallbackRoute() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('webmcp') === '1') return false;
  if (url.searchParams.get('presenter') === '1') return false;
  if (url.searchParams.has('share') || url.searchParams.has('embed')) return false;
  if (url.pathname.includes('/s/') || url.pathname.includes('/embed/')) return false;
  return window.matchMedia?.(editorMobileViewportQuery).matches ?? false;
}

function addPreconnect(href: string, crossOrigin = false) {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = href;
  if (crossOrigin) link.crossOrigin = '';
  document.head.append(link);
}

function loadEditorFonts() {
  addPreconnect('https://fonts.googleapis.com');
  addPreconnect('https://fonts.gstatic.com', true);
  const fontUrls = [
    'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300..800&family=Orbitron:wght@400..900&display=swap',
    'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
  ];
  for (const href of fontUrls) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.append(link);
  }
  void document.fonts?.load?.('20px "Material Symbols Outlined"').finally(() => {
    document.documentElement.classList.add('material-symbols-ready');
  });
}

function scheduleEditorFonts() {
  window.addEventListener(
    'load',
    () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(loadEditorFonts, { timeout: 2500 });
        return;
      }
      globalThis.setTimeout(loadEditorFonts, 1200);
    },
    { once: true },
  );
}

if (isEditorMobileFallbackRoute()) {
  document.documentElement.classList.add('editor-mobile-fallback-active');
} else {
  document.querySelector('[data-static-mobile-fallback]')?.remove();
  scheduleEditorFonts();
  void import('./main');
}
