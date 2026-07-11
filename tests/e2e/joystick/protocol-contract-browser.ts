export type JoystickProtocolContractInput = {
  sourceRoot: string;
  testSupportSourceRoot: string;
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
  testSupportSourceRoot,
}: JoystickProtocolContractInput): Promise<JoystickProtocolContractResult> {
  const [{ presenterRemoteProtocol }, { presenterRemoteSessionCode }, { presenterProtocolFixture }] =
    (await Promise.all([
      import(`${sourceRoot}/protocol.ts`),
      import(`${sourceRoot}/session-code.ts`),
      import(`${testSupportSourceRoot}/presenter-protocol-fixture.ts`),
    ])) as [
      typeof import('../../../packages/presenter-remote/src/protocol'),
      typeof import('../../../packages/presenter-remote/src/session-code'),
      typeof import('../support/presenter-protocol-fixture'),
    ];

  const slidePreview = presenterProtocolFixture.createPreview();
  const state = presenterProtocolFixture.createState();

  return {
    commandChecks: {
      acceptsClose: presenterRemoteProtocol.isCommand({ command: 'close', type: 'command' }),
      acceptsGoToPage: presenterRemoteProtocol.isCommand({
        command: 'go-to-page',
        pageId: 'page-1',
        type: 'command',
      }),
      acceptsRequestPreviews: presenterRemoteProtocol.isCommand({
        command: 'request-previews',
        pageIds: ['page-1'],
        requestId: 'preview-request',
        type: 'command',
      }),
      acceptsUpdateNotes: presenterRemoteProtocol.isCommand({
        command: 'update-notes',
        notes: 'Updated note',
        pageId: 'page-1',
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
        previews: [{ id: 'page-1', name: 'Intro', preview: slidePreview }],
        requestId: 'preview-request',
        type: 'preview-batch',
      }),
      acceptsPreviewWithoutRequest: presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'page-1', name: 'Intro' }],
        type: 'preview-batch',
      }),
      rejectsBadPreviewElement: !presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'page-1', name: 'Intro', preview: { elements: [], width: 1 } }],
        type: 'preview-batch',
      }),
      rejectsBadRequestId: !presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'page-1', name: 'Intro' }],
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
