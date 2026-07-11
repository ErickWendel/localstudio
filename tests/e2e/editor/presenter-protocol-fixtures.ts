function createPreview() {
  const textElement = {
    align: 'center',
    fill: '#ffffff',
    fontFamily: 'Inter',
    fontSize: 40,
    fontWeight: 700,
    height: 120,
    id: 'text',
    kind: 'text',
    opacity: 1,
    rotation: 0,
    text: 'Hello',
    width: 400,
    x: 0,
    y: 0,
  };
  const mediaElement = {
    assetUrl: 'blob:video',
    autoplay: true,
    controls: true,
    height: 180,
    id: 'media',
    kind: 'media',
    loop: false,
    mediaType: 'video',
    muted: true,
    opacity: 1,
    rotation: 0,
    width: 320,
    x: 10,
    y: 10,
  };
  const shapeElement = {
    fill: '#111111',
    height: 100,
    id: 'shape',
    kind: 'shape',
    opacity: 1,
    rotation: 0,
    shape: 'rectangle',
    stroke: '#ffffff',
    strokeWidth: 2,
    width: 100,
    x: 20,
    y: 20,
  };

  return {
    backgroundColor: '#000000',
    backgroundImageUrl: 'blob:bg',
    elements: [textElement, mediaElement, shapeElement],
    height: 1080,
    width: 1920,
  };
}

function createState() {
  const preview = createPreview();

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
}

function createCommands() {
  return [
    { command: 'close', type: 'command' },
    { command: 'next', type: 'command' },
    { command: 'previous', type: 'command' },
    { command: 'pause-timer', type: 'command' },
    { command: 'resume-timer', type: 'command' },
    { command: 'reset-timer', type: 'command' },
    { command: 'request-state', type: 'command' },
    { command: 'start-presenting', type: 'command' },
    { command: 'go-to-page', pageId: 'page-2', type: 'command' },
    { command: 'request-previews', pageIds: ['page-1'], requestId: 'request-1', type: 'command' },
    { command: 'update-notes', notes: 'Updated', pageId: 'page-1', type: 'command' },
  ];
}

export const presenterProtocolFixtures = {
  createCommands,
  createPreview,
  createState,
};
