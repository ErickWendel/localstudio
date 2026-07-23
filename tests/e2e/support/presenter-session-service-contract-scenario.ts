import type { loadPresenterSessionServiceModules } from './presenter-session-service-modules';
import {
  createPresenterSessionServiceContractResult,
  type PresenterSessionServiceContractResult,
} from './presenter-session-service-contract-result';

export async function runPresenterSessionServiceContractScenario(
  modules: Awaited<ReturnType<typeof loadPresenterSessionServiceModules>>,
): Promise<PresenterSessionServiceContractResult> {
  const {
    BrowserPresenterSessionService,
    countPresenterMessages,
    createFakePresenterPopup,
    createFakeRemotePeerControlHost,
    dispatchPresenterSessionWindowCommandSequence,
    emitPresenterSessionRemoteCommandSequence,
    flushAsyncWork,
    getPresenterCommandNames,
    presenterRoutePayload,
  } = modules;
  const popup = createFakePresenterPopup();
  const commands: unknown[] = [];
  const host = createFakeRemotePeerControlHost();
  const legacyCommands: unknown[] = [];
  const legacyPublishedStates: unknown[] = [];
  let legacyCloseCount = 0;

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

  emitPresenterSessionRemoteCommandSequence(host);
  await flushAsyncWork();

  dispatchPresenterSessionWindowCommandSequence({
    origin: new URL(window.location.href).origin,
    sessionId: opened.sessionId,
    targetWindow: window,
  });
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        command: 'update-timer',
        sessionId: opened.sessionId,
        source: 'localstudio-presenter-window',
        timer: { elapsedMs: 1_500, paused: false, updatedAtEpochMs: 1_786_000_000_000 },
        type: 'command',
      },
      origin: new URL(window.location.href).origin,
    }),
  );
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        command: 'save-recording',
        recording: { id: 'recording-1', segments: [] },
        sessionId: opened.sessionId,
        source: 'localstudio-presenter-window',
        type: 'command',
      },
      origin: new URL(window.location.href).origin,
    }),
  );
  for (const command of ['close', 'previous', 'request-state', 'start-presenting'] as const) {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          command,
          sessionId: opened.sessionId,
          source: 'localstudio-presenter-window',
          type: 'command',
        },
        origin: new URL(window.location.href).origin,
      }),
    );
  }
  for (const invalidCommand of [
    { command: 'save-recording' },
    { command: 'update-stream-peer', peerId: 42 },
    { command: 'update-timer', timer: { elapsedMs: '1', paused: false } },
  ]) {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          ...invalidCommand,
          sessionId: opened.sessionId,
          source: 'localstudio-presenter-window',
          type: 'command',
        },
        origin: new URL(window.location.href).origin,
      }),
    );
  }
  service.publishState({
    ...presenterRoutePayload.create('slide-2'),
    streamPeerId: 'stream-peer-2',
  });
  await flushAsyncWork();

  unsubscribe();
  service.closePresenterWindow();

  const defaultHostService = new BrowserPresenterSessionService({
    href: window.location.href,
    presenterDeviceId: 'default-presenter-device',
    resolveRemoteControlOrigin: () => Promise.resolve(undefined),
    targetWindow: window,
  });
  await defaultHostService.openRemoteControlSession({
    presenterLabel: 'Default host',
    ttlMs: 1_000,
  });
  defaultHostService.closePresenterWindow();

  const originalFetch = window.fetch;
  for (const fetchResult of [
    () => Promise.resolve(new Response('', { status: 503 })),
    () => Promise.resolve(Response.json({ origin: 'https://remote-from-network.test' })),
    () => Promise.resolve(Response.json({ origin: 'not a url' })),
    () => Promise.reject(new Error('network origin unavailable')),
  ]) {
    const originHost = createFakeRemotePeerControlHost();
    window.fetch = fetchResult;
    const originService = new BrowserPresenterSessionService({
      href: 'http://localhost:5173/editor/',
      presenterDeviceId: 'origin-presenter-device',
      randomId: () => 'origin-session-1',
      remotePeerControlHostFactory: (options) => originHost.attach(options),
      targetWindow: window,
    });
    await originService.openRemoteControlSession({
      presenterLabel: 'Origin laptop',
      ttlMs: 1_000,
    });
    originService.closePresenterWindow();
  }
  window.fetch = originalFetch;

  const legacyService = new BrowserPresenterSessionService({
    href: window.location.href,
    presenterDeviceId: 'legacy-presenter-device',
    remoteSignalingService: {
      closeSession: () => {
        legacyCloseCount += 1;
        return true;
      },
      publishState: (_code, state) => {
        legacyPublishedStates.push(state);
        return true;
      },
      registerSession: (input) => ({
        code: 'LEGACY-1',
        connectedControllerCount: 2,
        expiresAt: new Date(Date.now() + input.ttlMs).toISOString(),
        presenterDeviceId: input.presenterDeviceId ?? 'legacy-device',
        presenterLabel: input.presenterLabel,
        sessionId: 'legacy-session-1',
      }),
      takeCommands: () => [
        { command: 'resume-timer', type: 'command' },
        { command: 'reset-timer', type: 'command' },
      ],
    },
    resolveRemoteControlOrigin: () => Promise.resolve(undefined),
    targetWindow: window,
  });
  const unsubscribeLegacy = legacyService.subscribeToCommands((command) =>
    legacyCommands.push(command),
  );
  await legacyService.openRemoteControlSession({
    presenterLabel: 'Legacy laptop',
    ttlMs: 2_000,
  });
  legacyService.publishState({
    ...presenterRoutePayload.create('slide-1'),
    timer: { elapsedMs: 100, paused: true, updatedAtEpochMs: 1_786_000_000_000 },
  });
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        command: 'update-notes',
        notes: 42,
        pageId: 'slide-1',
        sessionId: 'ignored-session',
        source: 'localstudio-presenter-window',
        type: 'command',
      },
      origin: new URL(window.location.href).origin,
    }),
  );
  await new Promise((resolve) => window.setTimeout(resolve, 300));
  unsubscribeLegacy();
  legacyService.closePresenterWindow();

  return createPresenterSessionServiceContractResult({
    blocked,
    commands,
    countPresenterMessages,
    duplicateSession,
    getPresenterCommandNames,
    host,
    legacyCloseCount,
    legacyCommands,
    legacyPublishCount: legacyPublishedStates.length,
    opened,
    popup,
    remoteSession,
  });
}
