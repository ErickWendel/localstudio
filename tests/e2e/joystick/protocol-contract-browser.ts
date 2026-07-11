export type JoystickProtocolContractInput = {
  sourceRoot: string;
};

export type JoystickProtocolContractResult = {
  commandChecks: Record<string, boolean>;
  previewBatchChecks: Record<string, boolean>;
  sessionChecks: Record<string, boolean>;
  sessionCodeChecks: Record<string, string | boolean>;
  stateChecks: Record<string, boolean>;
  streamPreferenceChecks: Record<string, boolean>;
};

export async function evaluateJoystickProtocolContract({
  sourceRoot,
}: JoystickProtocolContractInput): Promise<JoystickProtocolContractResult> {
  const { presenterRemoteProtocol } = (await import(
    `${sourceRoot}/protocol.ts`
  )) as typeof import('../../../packages/presenter-remote/src/protocol');
  const { presenterRemoteSessionCode } = (await import(
    `${sourceRoot}/session-code.ts`
  )) as typeof import('../../../packages/presenter-remote/src/session-code');

  const slidePreview = {
    backgroundColor: '#101820',
    backgroundImageUrl: 'https://assets.localstudio.test/background.png',
    elements: [
      {
        align: 'center',
        fill: '#ffffff',
        fontFamily: 'Inter',
        fontSize: 32,
        fontWeight: 700,
        height: 64,
        id: 'title',
        kind: 'text',
        lineHeight: 1.2,
        opacity: 1,
        rotation: 0,
        text: 'Protocol',
        verticalAlign: 'middle',
        width: 500,
        x: 20,
        y: 30,
      },
      {
        assetUrl: 'https://assets.localstudio.test/image.png',
        height: 180,
        id: 'image',
        kind: 'image',
        opacity: 0.9,
        rotation: 0,
        width: 240,
        x: 60,
        y: 130,
      },
      {
        assetUrl: 'https://assets.localstudio.test/clip.mp4',
        autoplay: true,
        controls: false,
        height: 180,
        id: 'video',
        kind: 'media',
        loop: true,
        mediaType: 'video',
        muted: true,
        opacity: 1,
        rotation: 0,
        width: 240,
        x: 330,
        y: 130,
      },
      {
        fill: '#ffcc00',
        height: 80,
        id: 'shape',
        kind: 'shape',
        opacity: 1,
        rotation: 0,
        shape: 'rounded-rectangle',
        stroke: '#101820',
        strokeWidth: 2,
        width: 140,
        x: 20,
        y: 340,
      },
    ],
    height: 720,
    width: 1280,
  };

  const state = {
    activePageId: 'slide-1',
    activePageIndex: 0,
    activePageName: 'Intro',
    builds: { current: 1, remaining: 2, total: 3 },
    buildsRemaining: 2,
    commandAvailability: ['next', 'request-previews'],
    connectedControllerCount: 1,
    deckName: 'Protocol contract',
    nextPageName: 'Close',
    nextSlidePreview: slidePreview,
    notes: 'Speaker notes',
    pageCount: 2,
    pages: [{ id: 'slide-1', name: 'Intro', preview: slidePreview }],
    previewMode: 'structured-fallback',
    presenterMode: 'presenting',
    shortcuts: ['Swipe to navigate'],
    slidePreview,
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
    upcomingSlidePreviews: [{ pageId: 'slide-2', pageName: 'Close', preview: slidePreview }],
  };

  return {
    commandChecks: {
      acceptsClose: presenterRemoteProtocol.isCommand({ command: 'close', type: 'command' }),
      acceptsGoToPage: presenterRemoteProtocol.isCommand({
        command: 'go-to-page',
        pageId: 'slide-1',
        type: 'command',
      }),
      acceptsRequestPreviews: presenterRemoteProtocol.isCommand({
        command: 'request-previews',
        pageIds: ['slide-1'],
        requestId: 'preview-request',
        type: 'command',
      }),
      acceptsUpdateNotes: presenterRemoteProtocol.isCommand({
        command: 'update-notes',
        notes: 'Updated note',
        pageId: 'slide-1',
        type: 'command',
      }),
      rejectsBadPageId: !presenterRemoteProtocol.isCommand({
        command: 'go-to-page',
        pageId: 1,
        type: 'command',
      }),
      rejectsBadPreviewRequest: !presenterRemoteProtocol.isCommand({
        command: 'request-previews',
        pageIds: ['slide-1', 2],
        type: 'command',
      }),
      rejectsUnknownCommand: !presenterRemoteProtocol.isCommand({
        command: 'unknown',
        type: 'command',
      }),
    },
    previewBatchChecks: {
      acceptsFullPreview: presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'slide-1', name: 'Intro', preview: slidePreview }],
        requestId: 'preview-request',
        type: 'preview-batch',
      }),
      acceptsPreviewWithoutRequest: presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'slide-1', name: 'Intro' }],
        type: 'preview-batch',
      }),
      rejectsBadPreviewElement: !presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'slide-1', name: 'Intro', preview: { elements: [], width: 1 } }],
        type: 'preview-batch',
      }),
      rejectsBadRequestId: !presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'slide-1', name: 'Intro' }],
        requestId: 10,
        type: 'preview-batch',
      }),
    },
    sessionChecks: {
      acceptsSession: presenterRemoteProtocol.isSession({
        code: 'ABCD-1234',
        connectedControllerCount: 1,
        expiresAt: '2026-07-10T12:01:00.000Z',
        presenterDeviceId: 'device-1',
        presenterLabel: 'Studio laptop',
        sessionId: 'session-1',
      }),
      rejectsMissingSessionId: !presenterRemoteProtocol.isSession({
        code: 'ABCD-1234',
        connectedControllerCount: 1,
        expiresAt: '2026-07-10T12:01:00.000Z',
        presenterDeviceId: 'device-1',
        presenterLabel: 'Studio laptop',
      }),
    },
    sessionCodeChecks: {
      createdFallback: presenterRemoteSessionCode.create(() => 2).endsWith('AAAA'),
      normalizedShort: presenterRemoteSessionCode.normalize('ab 12'),
      normalizedSpaced: presenterRemoteSessionCode.normalize('ab12 cd34'),
      rejectsInvalid: presenterRemoteSessionCode.isValid('IOOO-0000') === false,
      validatesNormalized: presenterRemoteSessionCode.isValid('ab12 cd34'),
    },
    stateChecks: {
      acceptsFullState: presenterRemoteProtocol.isState(state),
      acceptsReadyState: presenterRemoteProtocol.isState({
        ...state,
        nextSlidePreview: undefined,
        previewMode: 'stream',
        presenterMode: 'ready',
        slidePreview: undefined,
        stream: undefined,
        upcomingSlidePreviews: undefined,
      }),
      rejectsBadBuilds: !presenterRemoteProtocol.isState({
        ...state,
        builds: { current: '1', remaining: 2, total: 3 },
      }),
      rejectsBadPreviewMode: !presenterRemoteProtocol.isState({
        ...state,
        previewMode: 'thumbnail',
      }),
      rejectsBadStream: !presenterRemoteProtocol.isState({
        ...state,
        stream: { enabled: true, fps: 30, height: 720, transport: 'webrtc', width: 1280 },
      }),
      rejectsMissingTimer: !presenterRemoteProtocol.isState({
        ...state,
        timer: undefined,
      }),
    },
    streamPreferenceChecks: {
      acceptsAuto: presenterRemoteProtocol.isStreamPreference({
        fps: 30,
        height: 720,
        quality: 'auto',
        type: 'stream-preference',
        width: 1280,
      }),
      acceptsMedium: presenterRemoteProtocol.isStreamPreference({
        fps: 30,
        height: 720,
        quality: 'medium',
        type: 'stream-preference',
        width: 1280,
      }),
      rejectsBadQuality: !presenterRemoteProtocol.isStreamPreference({
        fps: 30,
        height: 720,
        quality: 'best',
        type: 'stream-preference',
        width: 1280,
      }),
      rejectsZeroDimensions: !presenterRemoteProtocol.isStreamPreference({
        fps: 0,
        height: 0,
        quality: 'low',
        type: 'stream-preference',
        width: 0,
      }),
    },
  };
}
