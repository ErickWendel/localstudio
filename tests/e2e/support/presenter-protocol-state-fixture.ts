import { createPresenterProtocolPreview } from './presenter-protocol-preview-fixture';

export function createPresenterProtocolState() {
  const preview = createPresenterProtocolPreview();

  return {
    activePageId: 'page-1',
    activePageIndex: 0,
    activePageName: 'Intro',
    builds: { current: 1, remaining: 2, total: 3 },
    buildsRemaining: 2,
    commandAvailability: ['next', 'request-previews'],
    connectedControllerCount: 1,
    deckName: 'Protocol contract',
    nextPageName: 'Close',
    nextSlidePreview: preview,
    notes: 'Speaker notes',
    pageCount: 2,
    pages: [{ id: 'page-1', name: 'Intro', preview }],
    previewMode: 'structured-fallback',
    presenterMode: 'presenting',
    shortcuts: ['Swipe to navigate'],
    slidePreview: preview,
    stream: {
      enabled: true,
      fps: 30,
      height: 720,
      peerId: 'stream-peer',
      transport: 'peerjs',
      width: 1280,
    },
    timer: { elapsedMs: 12_000, paused: false, updatedAtEpochMs: 1_786_000_000_000 },
    type: 'state',
    upcomingSlidePreviews: [{ pageId: 'page-2', pageName: 'Close', preview }],
  };
}
