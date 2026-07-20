import type {
  PresenterCommandMessage,
  PresenterRemoteSessionMetadata,
  PresenterStateMessage,
  PresenterStatePayload,
  PresenterWindowCommand,
} from './presenterSessionTypes';
import type { PresenterRemotePeerControlHostOptions } from '@localstudio/presenter-remote/peer-control-host';
import type { RegisterPresenterRemoteSessionInput } from '@localstudio/presenter-remote/signaling-service';
import type {
  PresenterRemoteCommand,
  PresenterRemotePeerSession,
  PresenterRemotePreviewBatch,
  PresenterRemoteSession,
  PresenterRemoteState,
  PresenterRemoteTimerState,
} from '@localstudio/presenter-remote/protocol';
import { presenterRemoteDebugLog } from '@localstudio/presenter-remote/debug-log';
import { presenterRemoteStateFactory } from './presenterRemoteStateFactory';

type OpenPresenterWindow = (url: string, target: string, features: string) => Window | null;
type ResolveRemoteControlOrigin = (origin: string) => Promise<string | undefined>;
type PresenterRemotePeerControl = {
  close: () => void;
  open: () => Promise<PresenterRemotePeerSession>;
  publishPreviewBatch: (batch: PresenterRemotePreviewBatch) => void;
  publishState: (state: PresenterRemoteState) => void;
};
type PresenterRemoteSignaling = {
  closeSession: (code: string) => boolean | Promise<unknown>;
  publishState: (code: string, state: PresenterRemoteState) => boolean | Promise<unknown>;
  registerSession: (
    input: RegisterPresenterRemoteSessionInput,
  ) => PresenterRemoteSession | Promise<PresenterRemoteSession>;
  takeCommands: (code: string) => PresenterRemoteCommand[] | Promise<PresenterRemoteCommand[]>;
};
type CreatePresenterRemotePeerControlHost = (
  options: PresenterRemotePeerControlHostOptions,
) => PresenterRemotePeerControl;

interface BrowserPresenterSessionServiceOptions {
  href?: string;
  openWindow?: OpenPresenterWindow;
  presenterDeviceId?: string | undefined;
  randomId?: () => string;
  remotePeerControlHostFactory?: CreatePresenterRemotePeerControlHost | undefined;
  remoteSignalingService?: PresenterRemoteSignaling | undefined;
  resolveRemoteControlOrigin?: ResolveRemoteControlOrigin | undefined;
  targetWindow?: Window;
}

type PresenterWindowOpenResult =
  | { status: 'blocked'; sessionId: string }
  | { status: 'opened'; sessionId: string };

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `presenter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const presenterDeviceIdKey = 'localstudio.presenter.deviceId';

function getOrCreatePresenterDeviceId(targetWindow: Window) {
  try {
    const existingId = targetWindow.localStorage.getItem(presenterDeviceIdKey);
    if (existingId) return existingId;
    const id = createSessionId();
    targetWindow.localStorage.setItem(presenterDeviceIdKey, id);
    return id;
  } catch {
    return createSessionId();
  }
}

function isPresenterCommandMessage(value: unknown): value is PresenterCommandMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === 'localstudio-presenter-window' &&
    record.type === 'command' &&
    typeof record.sessionId === 'string' &&
    typeof record.command === 'string'
  );
}

export class BrowserPresenterSessionService {
  private readonly href: string;
  private readonly openWindow: OpenPresenterWindow;
  private readonly origin: string;
  private readonly presenterDeviceId: string;
  private readonly randomId: () => string;
  private readonly resolveRemoteControlOrigin: ResolveRemoteControlOrigin;
  private readonly legacyRemoteSignalingService: PresenterRemoteSignaling | undefined;
  private readonly remotePeerControlHostFactory: CreatePresenterRemotePeerControlHost;
  private readonly targetWindow: Window;
  private popupWindow: Window | null = null;
  private presenterTimer: PresenterRemoteTimerState | undefined;
  private presenterTimerReceivedAt = 0;
  private lastPresenterPayload: PresenterStatePayload | undefined;
  private remoteSession: PresenterRemoteSessionMetadata | undefined;
  private remoteSessionStartedAt = 0;
  private remoteStatePublishSequence = 0;
  private remoteCommandHandler: ((command: PresenterRemoteCommand) => void) | undefined;
  private remotePeerControlHost: PresenterRemotePeerControl | undefined;
  private remoteSessionOpening: Promise<PresenterRemoteSessionMetadata> | undefined;
  private sessionId: string | undefined;

  constructor(options: BrowserPresenterSessionServiceOptions = {}) {
    const targetWindow = options.targetWindow ?? window;
    this.targetWindow = targetWindow;
    this.href = options.href ?? targetWindow.location.href;
    this.origin = new URL(this.href).origin;
    this.openWindow =
      options.openWindow ?? ((url, target, features) => targetWindow.open(url, target, features));
    this.presenterDeviceId =
      options.presenterDeviceId ?? getOrCreatePresenterDeviceId(targetWindow);
    this.randomId = options.randomId ?? createSessionId;
    this.resolveRemoteControlOrigin =
      options.resolveRemoteControlOrigin ?? resolveRemoteControlOrigin;
    this.remotePeerControlHostFactory =
      options.remotePeerControlHostFactory ?? createDefaultRemotePeerControlHostFactory();
    this.legacyRemoteSignalingService = options.remoteSignalingService;
  }

  openPresenterWindow(): PresenterWindowOpenResult {
    const sessionId = this.randomId();
    const url = new URL(this.href);
    url.searchParams.set('presenter', '1');
    url.searchParams.set('presenterSession', sessionId);
    const popupWindow = this.openWindow(
      '',
      `localstudio-presenter-${sessionId}`,
      'popup,width=1280,height=760',
    );
    if (!popupWindow || popupWindow === this.targetWindow) {
      this.sessionId = sessionId;
      this.popupWindow = null;
      return { status: 'blocked', sessionId };
    }
    popupWindow.location.href = url.toString();
    this.sessionId = sessionId;
    this.popupWindow = popupWindow;
    return { status: 'opened', sessionId };
  }

  publishState(payload: PresenterStatePayload) {
    this.lastPresenterPayload = payload;
    const presenterPayload = this.remoteSession
      ? { ...payload, remoteSession: this.remoteSession }
      : payload;
    if (this.sessionId && this.popupWindow && !this.popupWindow.closed) {
      const message: PresenterStateMessage = {
        payload: presenterPayload,
        sessionId: this.sessionId,
        source: 'localstudio-presenter-main',
        type: 'state',
      };
      this.popupWindow.postMessage(message, this.origin);
    }
    if (this.remoteSession && this.legacyRemoteSignalingService) {
      const publishSequence = ++this.remoteStatePublishSequence;
      const sessionCode = this.remoteSession.code;
      void Promise.resolve(
        this.legacyRemoteSignalingService.publishState(
          sessionCode,
          presenterRemoteStateFactory.createRemoteStateSkeleton(
            payload,
            this.remoteSession.connectedControllerCount,
            this.getCurrentPresenterTimer(
              payload.timer,
              this.remoteSessionStartedAt ? Date.now() - this.remoteSessionStartedAt : 0,
            ),
          ),
        ),
      );
      void this.createRemoteState(
        payload,
        this.remoteSession.connectedControllerCount,
        this.remoteSessionStartedAt ? Date.now() - this.remoteSessionStartedAt : 0,
      )
        .then((remoteState) => {
          if (publishSequence !== this.remoteStatePublishSequence) return;
          void Promise.resolve(
            this.legacyRemoteSignalingService?.publishState(sessionCode, remoteState),
          );
        })
        .catch((error: unknown) => {
          presenterRemoteDebugLog.error('Failed to create legacy remote state.', error);
        });
      return;
    }
    if (this.remoteSession) {
      const publishSequence = ++this.remoteStatePublishSequence;
      this.remotePeerControlHost?.publishState(
        presenterRemoteStateFactory.createRemoteStateSkeleton(
          payload,
          this.remoteSession.connectedControllerCount,
          this.getCurrentPresenterTimer(
            payload.timer,
            this.remoteSessionStartedAt ? Date.now() - this.remoteSessionStartedAt : 0,
          ),
        ),
      );
      void this.createRemoteState(
        payload,
        this.remoteSession.connectedControllerCount,
        this.remoteSessionStartedAt ? Date.now() - this.remoteSessionStartedAt : 0,
      )
        .then((remoteState) => {
          if (publishSequence !== this.remoteStatePublishSequence) return;
          this.remotePeerControlHost?.publishState(remoteState);
        })
        .catch((error: unknown) => {
          presenterRemoteDebugLog.error('Failed to create PeerJS remote state.', error);
        });
    }
  }

  closePresenterWindow() {
    if (this.popupWindow && !this.popupWindow.closed) this.popupWindow.close();
    this.popupWindow = null;
    if (this.legacyRemoteSignalingService && this.remoteSession)
      void Promise.resolve(this.legacyRemoteSignalingService.closeSession(this.remoteSession.code));
    this.remotePeerControlHost?.close();
    this.remotePeerControlHost = undefined;
    this.remoteSession = undefined;
    this.remoteSessionOpening = undefined;
    this.sessionId = undefined;
  }

  async openRemoteControlSession(
    input: RegisterPresenterRemoteSessionInput,
  ): Promise<PresenterRemoteSessionMetadata> {
    if (this.remoteSession) return this.remoteSession;
    if (this.remoteSessionOpening) return this.remoteSessionOpening;
    this.remoteSessionOpening = this.createRemoteControlSession(input).finally(() => {
      this.remoteSessionOpening = undefined;
    });
    return this.remoteSessionOpening;
  }

  private async createRemoteControlSession(
    input: RegisterPresenterRemoteSessionInput,
  ): Promise<PresenterRemoteSessionMetadata> {
    if (this.legacyRemoteSignalingService) {
      const session = await this.legacyRemoteSignalingService.registerSession({
        ...input,
        presenterDeviceId: input.presenterDeviceId ?? this.presenterDeviceId,
      });
      const remoteOrigin = (await this.resolveRemoteControlOrigin(this.origin)) ?? this.origin;
      const qrUrl = new URL('/joystick/', remoteOrigin);
      qrUrl.searchParams.set('code', session.code);
      this.remoteSession = {
        ...session,
        qrUrl: qrUrl.toString(),
      };
      this.remoteSessionStartedAt = Date.now();
      return this.remoteSession;
    }
    const host = this.remotePeerControlHostFactory({
      onCommand: (command) => this.remoteCommandHandler?.(command),
      presenterDeviceId: input.presenterDeviceId ?? this.presenterDeviceId,
      presenterLabel: input.presenterLabel,
      ttlMs: input.ttlMs,
    });
    this.remotePeerControlHost = host;
    const session = await host.open();
    const remoteOrigin = (await this.resolveRemoteControlOrigin(this.origin)) ?? this.origin;
    const qrUrl = new URL('/joystick/', remoteOrigin);
    qrUrl.searchParams.set('peer', session.controlPeerId);
    this.remoteSession = {
      ...session,
      qrUrl: qrUrl.toString(),
    };
    this.remoteSessionStartedAt = Date.now();
    if (this.lastPresenterPayload) this.publishState(this.lastPresenterPayload);
    return this.remoteSession;
  }

  getRemoteControlSession() {
    return this.remoteSession;
  }

  subscribeToCommands(handler: (command: PresenterWindowCommand) => void) {
    const handleRemoteCommand = (command: PresenterRemoteCommand) => {
      if (command.command === 'request-previews') {
        void this.publishPreviewBatch(command.pageIds, command.requestId);
        return;
      }
      if (
        command.command === 'pause-timer' ||
        command.command === 'reset-timer' ||
        command.command === 'resume-timer'
      ) {
        this.postPresenterCommand(command);
      }
      if (command.command === 'update-notes') {
        handler({ command: command.command, notes: command.notes, pageId: command.pageId });
        return;
      }
      if (command.command === 'go-to-page') {
        handler({ command: command.command, pageId: command.pageId });
        return;
      }
      handler({ command: command.command });
    };
    this.remoteCommandHandler = handleRemoteCommand;
    const listener = (event: MessageEvent) => {
      if (event.origin !== this.origin) return;
      if (!isPresenterCommandMessage(event.data)) return;
      if (!this.sessionId || event.data.sessionId !== this.sessionId) return;
      const { command } = event.data;
      if (command === 'update-notes') {
        if (typeof event.data.pageId !== 'string' || typeof event.data.notes !== 'string') return;
        handler({ command, notes: event.data.notes, pageId: event.data.pageId });
        return;
      }
      if (command === 'update-timer') {
        if (!presenterRemoteStateFactory.isPresenterRemoteTimerState(event.data.timer)) return;
        this.presenterTimer = event.data.timer;
        this.presenterTimerReceivedAt = Date.now();
        if (this.lastPresenterPayload) this.publishState(this.lastPresenterPayload);
        return;
      }
      if (command === 'update-stream-peer') {
        if (event.data.peerId !== undefined && typeof event.data.peerId !== 'string') return;
        handler({ command, peerId: event.data.peerId });
        return;
      }
      if (command === 'go-to-page') {
        if (typeof event.data.pageId !== 'string') return;
        handler({ command, pageId: event.data.pageId });
        return;
      }
      if (command === 'save-recording') {
        if (!event.data.recording || typeof event.data.recording !== 'object') return;
        handler({
          audioBlob: event.data.audioBlob instanceof Blob ? event.data.audioBlob : undefined,
          command,
          recording: event.data.recording,
        });
        return;
      }
      if (
        command === 'close' ||
        command === 'next' ||
        command === 'pause-timer' ||
        command === 'previous' ||
        command === 'request-state' ||
        command === 'reset-timer' ||
        command === 'resume-timer' ||
        command === 'start-presenting'
      ) {
        handler({ command });
      }
    };
    this.targetWindow.addEventListener('message', listener);
    let takingRemoteCommands = false;
    const remoteIntervalId = this.legacyRemoteSignalingService
      ? this.targetWindow.setInterval(() => {
          if (!this.remoteSession || !this.legacyRemoteSignalingService) return;
          if (takingRemoteCommands) return;
          takingRemoteCommands = true;
          void Promise.resolve(
            this.legacyRemoteSignalingService.takeCommands(this.remoteSession.code),
          )
            .then((commands) => {
              for (const command of commands) {
                handleRemoteCommand(command);
              }
            })
            .finally(() => {
              takingRemoteCommands = false;
            });
        }, 250)
      : 0;
    return () => {
      this.remoteCommandHandler = undefined;
      this.targetWindow.removeEventListener('message', listener);
      if (remoteIntervalId) this.targetWindow.clearInterval(remoteIntervalId);
    };
  }

  private postPresenterCommand(command: PresenterRemoteCommand) {
    if (!this.sessionId || !this.popupWindow || this.popupWindow.closed) return;
    this.popupWindow.postMessage(
      {
        ...command,
        sessionId: this.sessionId,
        source: 'localstudio-presenter-main',
        type: 'command',
      },
      this.origin,
    );
  }

  private async publishPreviewBatch(pageIds: string[], requestId: string | undefined) {
    if (!this.lastPresenterPayload || !this.remotePeerControlHost) return;
    try {
      const batches = await presenterRemoteStateFactory.createRemotePreviewBatches(
        this.lastPresenterPayload,
        pageIds,
        requestId,
      );
      for (const batch of batches) this.remotePeerControlHost.publishPreviewBatch(batch);
    } catch (error) {
      presenterRemoteDebugLog.error('Failed to create PeerJS preview batch.', error);
    }
  }

  private createRemoteState(
    payload: PresenterStatePayload,
    connectedControllerCount: number,
    elapsedMs: number,
  ) {
    return presenterRemoteStateFactory.createRemoteState(
      payload,
      connectedControllerCount,
      this.getCurrentPresenterTimer(payload.timer, elapsedMs),
    );
  }

  private getCurrentPresenterTimer(
    payloadTimer: PresenterRemoteTimerState | undefined,
    elapsedMs: number,
  ) {
    const now = Date.now();
    if (!this.presenterTimer) {
      return payloadTimer ?? { elapsedMs, paused: false, updatedAtEpochMs: now };
    }
    if (this.presenterTimer.paused || !this.presenterTimerReceivedAt) return this.presenterTimer;
    return {
      elapsedMs: this.presenterTimer.elapsedMs + (now - this.presenterTimerReceivedAt),
      paused: false,
      updatedAtEpochMs: now,
    };
  }
}

class TestPresenterRemotePeerControlHost implements PresenterRemotePeerControl {
  private readonly options: PresenterRemotePeerControlHostOptions;

  constructor(options: PresenterRemotePeerControlHostOptions) {
    this.options = options;
  }

  open(): Promise<PresenterRemotePeerSession> {
    const controlPeerId = 'ABCD-1234';
    return Promise.resolve({
      code: controlPeerId,
      connectedControllerCount: 0,
      controlPeerId,
      expiresAt: new Date((this.options.now ?? Date.now)() + this.options.ttlMs).toISOString(),
      presenterDeviceId: this.options.presenterDeviceId ?? this.options.presenterLabel,
      presenterLabel: this.options.presenterLabel,
      sessionId: 'test-peer-session',
      transport: 'peerjs',
    });
  }

  publishState(state: PresenterRemoteState) {
    void state;
  }

  publishPreviewBatch(batch: PresenterRemotePreviewBatch) {
    void batch;
    // Test host only records current state; preview transport is covered by host tests.
  }

  close() {
    // Test host has no persistent transport to close.
  }
}

class DeferredPresenterRemotePeerControlHost implements PresenterRemotePeerControl {
  private readonly options: PresenterRemotePeerControlHostOptions;
  private host: PresenterRemotePeerControl | undefined;
  private hostPromise: Promise<PresenterRemotePeerControl> | undefined;

  constructor(options: PresenterRemotePeerControlHostOptions) {
    this.options = options;
  }

  async open(): Promise<PresenterRemotePeerSession> {
    const host = await this.getHost();
    return host.open();
  }

  publishState(state: PresenterRemoteState) {
    this.host?.publishState(state);
  }

  publishPreviewBatch(batch: PresenterRemotePreviewBatch) {
    this.host?.publishPreviewBatch(batch);
  }

  close() {
    if (this.host) {
      this.host.close();
      return;
    }
    void this.hostPromise?.then((host) => host.close());
  }

  private async getHost(): Promise<PresenterRemotePeerControl> {
    this.hostPromise ??= Promise.all([
      import('@localstudio/presenter-remote/peer-control-host'),
      import('@localstudio/presenter-remote/peer-options'),
    ]).then(([peerControlHostModule, peerOptionsModule]) => {
      const host = new peerControlHostModule.PresenterRemotePeerControlHost({
        ...this.options,
        peerOptions: peerOptionsModule.getRuntimePeerOptions(),
      });
      this.host = host;
      return host;
    });
    return this.hostPromise;
  }
}

function createDefaultRemotePeerControlHostFactory(): CreatePresenterRemotePeerControlHost {
  if (isTestRuntime()) return (hostOptions) => new TestPresenterRemotePeerControlHost(hostOptions);
  return (hostOptions) => new DeferredPresenterRemotePeerControlHost(hostOptions);
}

function isTestRuntime() {
  return import.meta.env.MODE === 'test';
}

function isLoopbackOrigin(origin: string) {
  const hostname = new URL(origin).hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  );
}

function isValidRemoteOrigin(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const origin = new URL(value);
    return origin.protocol === 'http:' || origin.protocol === 'https:';
  } catch {
    return false;
  }
}

async function resolveRemoteControlOrigin(origin: string) {
  if (!isLoopbackOrigin(origin)) return origin;
  try {
    const response = await fetch('/__localstudio/network-origin', { cache: 'no-store' });
    if (!response.ok) return origin;
    const payload = (await response.json()) as { origin?: unknown };
    return isValidRemoteOrigin(payload.origin) ? payload.origin : origin;
  } catch {
    return origin;
  }
}
