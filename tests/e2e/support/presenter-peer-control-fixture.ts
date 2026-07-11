function hasCommand(message: unknown, command: string) {
  return (
    typeof message === 'object' &&
    message !== null &&
    'command' in message &&
    message.command === command
  );
}

function hasType(message: unknown, type: string) {
  return typeof message === 'object' && message !== null && 'type' in message && message.type === type;
}

export const presenterPeerControlFixture = {
  countMessages(messages: unknown[], predicate: (message: unknown) => boolean) {
    return messages.filter(predicate).length;
  },

  createClientPreviewBatch() {
    return {
      previews: [{ id: 'slide-1', name: 'Intro' }],
      requestId: 'client-preview-request',
      type: 'preview-batch',
    };
  },

  createClientState() {
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
  },

  createHostPreviewBatch() {
    return {
      previews: [{ pageId: 'slide-1', preview: 'data:image/png;base64,AA==' }],
      requestId: 'preview-request-1',
      type: 'preview-batch',
    };
  },

  createHostState() {
    return {
      activePageId: 'slide-1',
      activePageIndex: 0,
      buildsRemaining: 1,
      canGoNext: true,
      canGoPrevious: false,
      connectedControllerCount: 0,
      currentSlideIndex: 0,
      deckName: 'Peer contract',
      notes: 'Speaker note',
      pageCount: 2,
      pages: [{ id: 'slide-1', index: 0, title: 'Intro' }],
      presenterMode: 'presenting',
      shortcuts: ['Swipe to navigate'],
      slideCount: 2,
      slidePreview: { pageId: 'slide-1', preview: 'data:image/png;base64,AA==' },
      slideTitle: 'Intro',
      stream: { peerId: 'stream-peer-1', status: 'available' },
      timer: { elapsedMs: 1_000, paused: false },
      timerElapsedMs: 1_000,
      timerRunning: true,
      type: 'state',
    };
  },

  createReadyState() {
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
  },

  hasCommand,

  hasConnectedControllerCount(message: unknown, connectedControllerCount: number) {
    return (
      hasType(message, 'state') &&
      'connectedControllerCount' in message &&
      message.connectedControllerCount === connectedControllerCount
    );
  },

  hasType,
} as const;
