import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter protocol utility contracts in the browser runtime', async ({ page }) => {
  await page.goto(new URL('/editor/?newProject=1', serviceContractsSupport.getServer().baseURL).toString());

  const result = await page.evaluate(async ({ presenterRemoteSourceRoot }) => {
    const [
      { presenterRemoteDebugLog },
      { getRuntimePeerOptions },
      { presenterRemoteProtocol },
      { presenterRemoteTimerFormat },
    ] = (await Promise.all([
      import(`${presenterRemoteSourceRoot}/debug-log.ts`),
      import(`${presenterRemoteSourceRoot}/peer-options.ts`),
      import(`${presenterRemoteSourceRoot}/protocol.ts`),
      import(`${presenterRemoteSourceRoot}/timer-format.ts`),
    ])) as [
      typeof import('../../../packages/presenter-remote/src/debug-log'),
      typeof import('../../../packages/presenter-remote/src/peer-options'),
      typeof import('../../../packages/presenter-remote/src/protocol'),
      typeof import('../../../packages/presenter-remote/src/timer-format'),
    ];

    const logs: string[] = [];
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.info = (...values: unknown[]) => logs.push(`info:${values.join('|')}`);
    console.warn = (...values: unknown[]) => logs.push(`warn:${values.join('|')}`);
    console.error = (...values: unknown[]) => logs.push(`error:${values.join('|')}`);
    presenterRemoteDebugLog.info('ready');
    presenterRemoteDebugLog.warn('object', { ok: true });
    presenterRemoteDebugLog.error('failure', new TypeError('bad stream'));
    const circular: { self?: unknown } = {};
    circular.self = circular;
    presenterRemoteDebugLog.warn('circular', circular);
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;

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
    const preview = {
      backgroundColor: '#000000',
      backgroundImageUrl: 'blob:bg',
      elements: [textElement, mediaElement, shapeElement],
      height: 1080,
      width: 1920,
    };
    const state = {
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
    const commands = [
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
    globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__ = {
      host: 'localhost',
      path: '/peerjs',
      port: 9000,
      secure: false,
    };
    const peerOptions = getRuntimePeerOptions();
    globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__ = { host: '', port: 0 };
    const missingPeerOptions = getRuntimePeerOptions();

    return {
      commandResults: commands.map((command) => presenterRemoteProtocol.isCommand(command)),
      invalidCommand: presenterRemoteProtocol.isCommand({
        command: 'go-to-page',
        type: 'command',
      }),
      invalidPreviewBatch: presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'bad' }],
        type: 'preview-batch',
      }),
      invalidSession: presenterRemoteProtocol.isSession({ code: 'ABCD-1234' }),
      invalidState: presenterRemoteProtocol.isState({ ...state, timer: { paused: false } }),
      invalidStreamPreference: presenterRemoteProtocol.isStreamPreference({
        fps: 0,
        height: 720,
        quality: 'ultra',
        type: 'stream-preference',
        width: 1280,
      }),
      logs,
      missingPeerOptions,
      peerOptions,
      previewBatch: presenterRemoteProtocol.isPreviewBatch({
        previews: [{ id: 'page-1', name: 'Intro', preview }],
        requestId: 'request-1',
        type: 'preview-batch',
      }),
      session: presenterRemoteProtocol.isSession({
        code: 'ABCD-1234',
        connectedControllerCount: 1,
        expiresAt: '2026-07-09T12:00:00.000Z',
        presenterDeviceId: 'presenter',
        presenterLabel: 'Stage',
        sessionId: 'session-1',
      }),
      state: presenterRemoteProtocol.isState(state),
      streamPreference: presenterRemoteProtocol.isStreamPreference({
        fps: 30,
        height: 720,
        quality: 'medium',
        type: 'stream-preference',
        width: 1280,
      }),
      timers: [
        presenterRemoteTimerFormat.formatElapsed(-1),
        presenterRemoteTimerFormat.formatElapsed(65_000),
        presenterRemoteTimerFormat.formatElapsed(3_661_000),
      ],
    };
  }, { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot });

  expect(result).toMatchObject({
    invalidCommand: false,
    invalidPreviewBatch: false,
    invalidSession: false,
    invalidState: false,
    invalidStreamPreference: false,
    missingPeerOptions: undefined,
    peerOptions: { host: 'localhost', path: '/peerjs', port: 9000, secure: false },
    previewBatch: true,
    session: true,
    state: true,
    streamPreference: true,
    timers: ['00:00', '01:05', '01:01:01'],
  });
  expect(result.commandResults).toEqual(serviceContractsSupport.commandsAllTrue);
  expect(result.logs).toEqual(
    expect.arrayContaining([
      expect.stringContaining('info:[LocalStudio presenter remote]|ready'),
      expect.stringContaining('warn:[LocalStudio presenter remote]|object|{"ok":true}'),
      expect.stringContaining('error:[LocalStudio presenter remote]|failure|TypeError: bad stream'),
      expect.stringContaining('warn:[LocalStudio presenter remote]|circular|[object Object]'),
    ]),
  );
});
