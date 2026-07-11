export type PresenterSessionServiceContractInput = {
  editorSourceRoot: string;
  testSupportSourceRoot: string;
};

export type PresenterSessionServiceContractResult = {
  blockedStatus: string;
  commandNames: string[];
  duplicateSessionReused: boolean;
  hostCloseCount: number;
  hostOpenCount: number;
  hostPreviewBatchCount: number;
  hostStateCount: number;
  openedPopupHrefIncludesPresenter: boolean;
  openedStatus: string;
  popupClosed: boolean;
  popupCommandCount: number;
  popupStateCount: number;
  remoteSession: {
    controlPeerId: string | undefined;
    qrUrl: string;
    transport: string | undefined;
  };
};

export async function evaluatePresenterSessionServiceContract({
  editorSourceRoot,
  testSupportSourceRoot,
}: PresenterSessionServiceContractInput): Promise<PresenterSessionServiceContractResult> {
  const { loadPresenterSessionServiceModules } = (await import(
    `${testSupportSourceRoot}/presenter-session-service-modules.ts`
  )) as typeof import('../support/presenter-session-service-modules');
  const {
    BrowserPresenterSessionService,
    countPresenterMessages,
    createFakePresenterPopup,
    createFakeRemotePeerControlHost,
    dispatchPresenterWindowCommand,
    flushAsyncWork,
    getPresenterCommandNames,
    presenterRoutePayload,
  } = await loadPresenterSessionServiceModules({
    editorSourceRoot,
    testSupportSourceRoot,
  });

  const popup = createFakePresenterPopup();
  const commands: unknown[] = [];
  const host = createFakeRemotePeerControlHost();

  const service = new BrowserPresenterSessionService({
    href: window.location.href,
    openWindow: () => popup as never,
    presenterDeviceId: 'presenter-device-1',
    randomId: () => 'popup-session-1',
    remotePeerControlHostFactory: (options) => host.attach(options),
    resolveRemoteControlOrigin: () => Promise.resolve('https://remote.localstudio.test'),
    targetWindow: window,
  });
  const blockedService = new BrowserPresenterSessionService({
    href: window.location.href,
    openWindow: () => null,
    randomId: () => 'blocked-session-1',
    targetWindow: window,
  });

  const blocked = blockedService.openPresenterWindow();
  const opened = service.openPresenterWindow();
  const unsubscribe = service.subscribeToCommands((command) => commands.push(command));
  service.publishState({
    ...presenterRoutePayload.create('slide-1'),
    streamPeerId: 'stream-peer-1',
    timer: { elapsedMs: 1_000, paused: false, updatedAtEpochMs: 1_786_000_000_000 },
  });
  const [remoteSession, duplicateSession] = await Promise.all([
    service.openRemoteControlSession({
      presenterLabel: 'Studio laptop',
      ttlMs: 60_000,
    }),
    service.openRemoteControlSession({
      presenterLabel: 'Studio laptop',
      ttlMs: 60_000,
    }),
  ]);

  host.emitCommand({ command: 'request-previews', pageIds: ['slide-1', 'slide-2'], type: 'command' });
  host.emitCommand({ command: 'update-notes', notes: 'Updated note', pageId: 'slide-1', type: 'command' });
  host.emitCommand({ command: 'go-to-page', pageId: 'slide-2', type: 'command' });
  host.emitCommand({ command: 'pause-timer', type: 'command' });
  host.emitCommand({ command: 'next', type: 'command' });
  await flushAsyncWork();

  const origin = new URL(window.location.href).origin;
  dispatchPresenterWindowCommand(window, origin, {
    command: 'update-timer',
    sessionId: opened.sessionId,
    timer: { elapsedMs: 5_000, paused: false, updatedAtEpochMs: 1_786_000_005_000 },
  });
  dispatchPresenterWindowCommand(window, origin, {
    command: 'update-stream-peer',
    peerId: 'stream-peer-2',
    sessionId: opened.sessionId,
  });
  dispatchPresenterWindowCommand(window, origin, {
    command: 'go-to-page',
    pageId: 'slide-3',
    sessionId: opened.sessionId,
  });
  dispatchPresenterWindowCommand(window, origin, {
    command: 'next',
    sessionId: opened.sessionId,
  });
  dispatchPresenterWindowCommand(window, origin, {
    command: 'next',
    sessionId: 'wrong-session',
  });
  service.publishState({
    ...presenterRoutePayload.create('slide-2'),
    streamPeerId: 'stream-peer-2',
  });
  await flushAsyncWork();

  unsubscribe();
  service.closePresenterWindow();

  return {
    blockedStatus: blocked.status,
    commandNames: getPresenterCommandNames(commands),
    duplicateSessionReused: duplicateSession.sessionId === remoteSession.sessionId,
    hostCloseCount: host.closeCount,
    hostOpenCount: host.openCount,
    hostPreviewBatchCount: host.previewBatches.length,
    hostStateCount: host.states.length,
    openedPopupHrefIncludesPresenter: popup.location.href.includes('presenter=1'),
    openedStatus: opened.status,
    popupClosed: popup.closed,
    popupCommandCount: countPresenterMessages(popup.messages, 'command'),
    popupStateCount: countPresenterMessages(popup.messages, 'state'),
    remoteSession: {
      controlPeerId: remoteSession.controlPeerId,
      qrUrl: remoteSession.qrUrl,
      transport: remoteSession.transport,
    },
  };
}
