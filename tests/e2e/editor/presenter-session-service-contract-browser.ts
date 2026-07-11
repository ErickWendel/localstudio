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

type FakeRemoteCommand =
  | { command: 'go-to-page'; pageId: string; type: 'command' }
  | { command: 'next'; type: 'command' }
  | { command: 'pause-timer'; type: 'command' }
  | { command: 'request-previews'; pageIds: string[]; requestId?: string; type: 'command' }
  | { command: 'update-notes'; notes: string; pageId: string; type: 'command' };

export async function evaluatePresenterSessionServiceContract({
  editorSourceRoot,
  testSupportSourceRoot,
}: PresenterSessionServiceContractInput): Promise<PresenterSessionServiceContractResult> {
  const [{ BrowserPresenterSessionService }, { presenterRoutePayload }] = (await Promise.all([
    import(`${editorSourceRoot}/services/presenter/presenterSessionService.ts`),
    import(`${testSupportSourceRoot}/presenter-route-payload.ts`),
  ])) as [
    typeof import('../../../apps/editor/src/services/presenter/presenterSessionService'),
    typeof import('../support/presenter-route-payload'),
  ];

  const popupMessages: unknown[] = [];
  const popup = {
    closed: false,
    close() {
      this.closed = true;
    },
    location: { href: '' },
    postMessage(message: unknown) {
      popupMessages.push(message);
    },
  };
  const commands: unknown[] = [];
  const host = {
    closeCount: 0,
    openCount: 0,
    options: undefined as { onCommand?: (command: FakeRemoteCommand) => void } | undefined,
    previewBatches: [] as unknown[],
    states: [] as unknown[],
    close() {
      this.closeCount += 1;
    },
    emitCommand(command: FakeRemoteCommand) {
      this.options?.onCommand?.(command);
    },
    open() {
      this.openCount += 1;
      return Promise.resolve({
        code: 'peer-control-1',
        connectedControllerCount: 0,
        controlPeerId: 'peer-control-1',
        expiresAt: '2026-07-10T12:01:00.000Z',
        presenterDeviceId: 'presenter-device-1',
        presenterLabel: 'Studio laptop',
        sessionId: 'peer-session-1',
        transport: 'peerjs' as const,
      });
    },
    publishPreviewBatch(batch: unknown) {
      this.previewBatches.push(batch);
    },
    publishState(state: unknown) {
      this.states.push(state);
    },
  };

  const service = new BrowserPresenterSessionService({
    href: window.location.href,
    openWindow: () => popup as never,
    presenterDeviceId: 'presenter-device-1',
    randomId: () => 'popup-session-1',
    remotePeerControlHostFactory: (options) => {
      host.options = options;
      return host;
    },
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
    timer: { elapsedMs: 1_000, paused: false, updatedAtEpochMs: Date.now() },
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
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  const origin = new URL(window.location.href).origin;
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        command: 'update-timer',
        sessionId: opened.sessionId,
        source: 'localstudio-presenter-window',
        timer: { elapsedMs: 5_000, paused: false, updatedAtEpochMs: Date.now() },
        type: 'command',
      },
      origin,
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        command: 'update-stream-peer',
        peerId: 'stream-peer-2',
        sessionId: opened.sessionId,
        source: 'localstudio-presenter-window',
        type: 'command',
      },
      origin,
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        command: 'go-to-page',
        pageId: 'slide-3',
        sessionId: opened.sessionId,
        source: 'localstudio-presenter-window',
        type: 'command',
      },
      origin,
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        command: 'next',
        sessionId: opened.sessionId,
        source: 'localstudio-presenter-window',
        type: 'command',
      },
      origin,
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        command: 'next',
        sessionId: 'wrong-session',
        source: 'localstudio-presenter-window',
        type: 'command',
      },
      origin,
    }),
  );
  service.publishState({
    ...presenterRoutePayload.create('slide-2'),
    streamPeerId: 'stream-peer-2',
  });
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  unsubscribe();
  service.closePresenterWindow();

  return {
    blockedStatus: blocked.status,
    commandNames: commands.map((command) =>
      typeof command === 'object' && command !== null && 'command' in command
        ? String(command.command)
        : 'unknown',
    ),
    duplicateSessionReused: duplicateSession.sessionId === remoteSession.sessionId,
    hostCloseCount: host.closeCount,
    hostOpenCount: host.openCount,
    hostPreviewBatchCount: host.previewBatches.length,
    hostStateCount: host.states.length,
    openedPopupHrefIncludesPresenter: popup.location.href.includes('presenter=1'),
    openedStatus: opened.status,
    popupClosed: popup.closed,
    popupCommandCount: popupMessages.filter(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'command',
    ).length,
    popupStateCount: popupMessages.filter(
      (message) =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        message.type === 'state',
    ).length,
    remoteSession: {
      controlPeerId: remoteSession.controlPeerId,
      qrUrl: remoteSession.qrUrl,
      transport: remoteSession.transport,
    },
  };
}
