import { presenterProtocolPreviewFixture } from './presenter-protocol-preview-fixture';

export const presenterProtocolStateFixture = {
  createState() {
    const preview = presenterProtocolPreviewFixture.createPreview();

    return {
      activePageId: 'page-1',
      activePageIndex: 0,
      activePageName: 'Intro',
      builds: { current: 1, remaining: 2, total: 3 },
      buildsRemaining: 2,
      commandAvailability: ['next', 'previous'],
      connectedControllerCount: 1,
      deckName: 'Deck',
      nextPageName: 'Close',
      nextSlidePreview: preview,
      notes: 'Notes',
      pageCount: 2,
      pages: [{ id: 'page-1', name: 'Intro', preview }],
      previewMode: 'stream',
      presenterMode: 'presenting',
      shortcuts: ['ArrowRight'],
      slidePreview: preview,
      stream: {
        enabled: true,
        fps: 24,
        height: 720,
        peerId: 'peer-1',
        transport: 'peerjs',
        width: 1280,
      },
      timer: { elapsedMs: 65_000, paused: false, updatedAtEpochMs: 1_000 },
      type: 'state',
      upcomingSlidePreviews: [{ pageId: 'page-2', pageName: 'Close', preview }],
    };
  },
};
