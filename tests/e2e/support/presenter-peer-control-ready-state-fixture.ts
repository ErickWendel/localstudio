export function createPresenterPeerControlReadyState() {
  return {
    activePageId: 'slide-2',
    activePageIndex: 1,
    buildsRemaining: 0,
    canGoNext: false,
    canGoPrevious: true,
    connectedControllerCount: 0,
    currentSlideIndex: 1,
    deckName: 'Peer contract',
    notes: '',
    pageCount: 2,
    presenterMode: 'presenting',
    shortcuts: [],
    slideCount: 2,
    slideTitle: 'Close',
    timer: { elapsedMs: 2_000, paused: true },
    timerElapsedMs: 2_000,
    timerRunning: false,
    type: 'state',
  };
}
