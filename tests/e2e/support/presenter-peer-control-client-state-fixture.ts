export function createPresenterPeerControlClientState() {
  return {
    activePageId: 'slide-1',
    activePageIndex: 0,
    buildsRemaining: 0,
    connectedControllerCount: 1,
    deckName: 'Client state',
    notes: '',
    pageCount: 1,
    presenterMode: 'ready',
    shortcuts: [],
    timer: { elapsedMs: 0, paused: true },
    type: 'state',
  };
}
