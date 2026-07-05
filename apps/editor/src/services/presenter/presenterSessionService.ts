import type { DesignElement, Page, ProjectDocument } from '../../domain/documents/model';
import type {
  PresenterCommandMessage,
  PresenterRemoteSessionMetadata,
  PresenterStateMessage,
  PresenterStatePayload,
  PresenterWindowCommand,
} from './presenterSessionTypes';
import {
  PresenterRemotePeerControlHost,
  type PresenterRemotePeerControlHostOptions,
} from '@localstudio/presenter-remote/peer-control-host';
import type { RegisterPresenterRemoteSessionInput } from '@localstudio/presenter-remote/signaling-service';
import type {
  PresenterRemoteCommand,
  PresenterRemotePeerSession,
  PresenterRemotePreviewBatch,
  PresenterRemoteSlidePreview,
  PresenterRemoteSlidePreviewElement,
  PresenterRemoteUpcomingSlidePreview,
  PresenterRemoteSession,
  PresenterRemoteState,
  PresenterRemoteTimerState,
} from '@localstudio/presenter-remote/protocol';
import { presenterRemoteDebugLog } from '@localstudio/presenter-remote/debug-log';

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
const remotePreviewBatchMaxBytes = 10_000;
const remotePreviewMaxInlineAssetLength = 10_000;
const remotePreviewThumbnailMaxEdge = 96;
const remotePreviewThumbnailQuality = 0.32;

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
          createRemoteStateSkeleton(
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
        createRemoteStateSkeleton(
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
        if (!isPresenterRemoteTimerState(event.data.timer)) return;
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
      const batches = await createRemotePreviewBatches(
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
    return createRemoteState(
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

function isPresenterRemoteTimerState(value: unknown): value is PresenterRemoteTimerState {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.elapsedMs === 'number' &&
    typeof record.paused === 'boolean' &&
    (record.updatedAtEpochMs === undefined || typeof record.updatedAtEpochMs === 'number')
  );
}

class TestPresenterRemotePeerControlHost implements PresenterRemotePeerControl {
  private readonly options: PresenterRemotePeerControlHostOptions;
  private lastState: PresenterRemoteState | undefined;

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
    this.lastState = state;
  }

  publishPreviewBatch(batch: PresenterRemotePreviewBatch) {
    void batch;
    // Test host only records current state; preview transport is covered by host tests.
  }

  close() {
    this.lastState = undefined;
  }
}

function createDefaultRemotePeerControlHostFactory(): CreatePresenterRemotePeerControlHost {
  if (isTestRuntime()) return (hostOptions) => new TestPresenterRemotePeerControlHost(hostOptions);
  return (hostOptions) => new PresenterRemotePeerControlHost(hostOptions);
}

function isTestRuntime() {
  return import.meta.env.MODE === 'test';
}

function createRemoteStateSkeleton(
  payload: PresenterStatePayload,
  connectedControllerCount: number,
  timer: PresenterRemoteTimerState,
): PresenterRemoteState {
  const activePageIndex = Math.max(
    0,
    payload.project.pages.findIndex((page) => page.id === payload.activePageId),
  );
  const activePage = payload.project.pages[activePageIndex] ?? payload.project.pages[0];
  const nextPage = payload.project.pages[activePageIndex + 1];
  const activePageBuilds = activePage ? getRemoteBuildInfo(payload, activePage) : undefined;
  return {
    activePageId: activePage?.id ?? payload.activePageId,
    activePageIndex,
    activePageName: activePage?.name,
    builds: activePageBuilds?.total ? activePageBuilds : undefined,
    buildsRemaining: activePageBuilds?.remaining ?? 0,
    connectedControllerCount,
    deckName: payload.project.name,
    nextPageName: nextPage?.name,
    notes: activePage?.speakerNotes ?? '',
    pageCount: payload.project.pages.length,
    pages: payload.project.pages.map((page) => ({
      id: page.id,
      name: page.name,
    })),
    presenterMode: payload.presenterMode ?? 'presenting',
    commandAvailability: [
      'previous',
      'next',
      'go-to-page',
      'pause-timer',
      'resume-timer',
      'reset-timer',
      'play-pause-movie',
    ],
    previewMode: 'stream',
    shortcuts: ['previous', 'next', 'pause-timer', 'reset-timer'],
    stream: {
      enabled: true,
      fps: 8,
      height: 340,
      peerId: payload.streamPeerId,
      transport: 'peerjs',
      width: 390,
    },
    timer,
    type: 'state',
    upcomingSlidePreviews: [],
  };
}

function createRemoteState(
  payload: PresenterStatePayload,
  connectedControllerCount: number,
  timer: PresenterRemoteTimerState,
): Promise<PresenterRemoteState> {
  const activePageIndex = Math.max(
    0,
    payload.project.pages.findIndex((page) => page.id === payload.activePageId),
  );
  const activePage = payload.project.pages[activePageIndex] ?? payload.project.pages[0];
  const nextPage = payload.project.pages[activePageIndex + 1];
  const hiddenElementIds =
    activePage && payload.animationPreview?.pageId === activePage.id
      ? new Set(payload.animationPreview.hiddenElementIds)
      : undefined;
  const activePageBuilds = activePage ? getRemoteBuildInfo(payload, activePage) : undefined;
  const pages = payload.project.pages.map((page) => ({
    id: page.id,
    name: page.name,
  }));
  return Promise.all([
    activePage
      ? createSlidePreview(payload.project, activePage, hiddenElementIds)
      : Promise.resolve(undefined),
    createUpcomingSlidePreviews(
      payload.project,
      payload.project.pages.slice(activePageIndex + 1, activePageIndex + 4),
    ),
  ]).then(([slidePreview, upcomingSlidePreviews]) => ({
    activePageId: activePage?.id ?? payload.activePageId,
    activePageIndex,
    activePageName: activePage?.name,
    builds: activePageBuilds?.total ? activePageBuilds : undefined,
    buildsRemaining: activePageBuilds?.remaining ?? 0,
    connectedControllerCount,
    deckName: payload.project.name,
    nextPageName: nextPage?.name,
    nextSlidePreview: upcomingSlidePreviews[0]?.preview,
    notes: activePage?.speakerNotes ?? '',
    pageCount: payload.project.pages.length,
    pages,
    presenterMode: payload.presenterMode ?? 'presenting',
    commandAvailability: [
      'previous',
      'next',
      'go-to-page',
      'pause-timer',
      'resume-timer',
      'reset-timer',
      'play-pause-movie',
    ],
    previewMode: 'stream',
    shortcuts: ['previous', 'next', 'pause-timer', 'reset-timer'],
    slidePreview,
    stream: {
      enabled: true,
      fps: 8,
      height: 340,
      peerId: payload.streamPeerId,
      transport: 'peerjs',
      width: 390,
    },
    timer,
    type: 'state',
    upcomingSlidePreviews,
  }));
}

function getRemoteBuildInfo(payload: PresenterStatePayload, page: Page) {
  const validBuilds = (page.animationBuilds ?? []).filter((build) =>
    page.elementIds.includes(build.elementId),
  );
  if (validBuilds.length === 0) return { current: 0, remaining: 0, total: 0 };
  if (payload.animationPreview?.pageId !== page.id) {
    return { current: 1, remaining: validBuilds.length, total: validBuilds.length };
  }
  if (payload.animationPreview.phase === 'complete') {
    return { current: validBuilds.length, remaining: 0, total: validBuilds.length };
  }
  const hiddenElementIds = new Set(payload.animationPreview.hiddenElementIds);
  const remaining = validBuilds.filter((build) => hiddenElementIds.has(build.elementId)).length;
  return {
    current: Math.min(validBuilds.length, Math.max(1, validBuilds.length - remaining + 1)),
    remaining,
    total: validBuilds.length,
  };
}

function createUpcomingSlidePreviews(
  project: ProjectDocument,
  pages: Page[],
): Promise<PresenterRemoteUpcomingSlidePreview[]> {
  return Promise.all(
    pages.map((page) =>
      createSlidePreview(project, page).then((preview) => ({
        pageId: page.id,
        pageName: page.name,
        preview,
      })),
    ),
  );
}

async function createRemotePreviewBatches(
  payload: PresenterStatePayload,
  requestedPageIds: string[],
  requestId: string | undefined,
): Promise<PresenterRemotePreviewBatch[]> {
  const pageIds = new Set(requestedPageIds.slice(0, 5));
  const activePageIndex = Math.max(
    0,
    payload.project.pages.findIndex((page) => page.id === payload.activePageId),
  );
  const activePage = payload.project.pages[activePageIndex];
  const hiddenElementIds =
    activePage && payload.animationPreview?.pageId === activePage.id
      ? new Set(payload.animationPreview.hiddenElementIds)
      : undefined;
  const previews = await Promise.all(
    payload.project.pages
      .filter((page) => pageIds.has(page.id))
      .map(async (page) => ({
        id: page.id,
        name: page.name,
        preview: await createSlidePreview(
          payload.project,
          page,
          page.id === activePage?.id ? hiddenElementIds : undefined,
        ),
      })),
  );
  return createPreviewBatches(previews, requestId);
}

function createPreviewBatches(
  previews: PresenterRemotePreviewBatch['previews'],
  requestId: string | undefined,
) {
  const batches: PresenterRemotePreviewBatch[] = [];
  let currentBatch: PresenterRemotePreviewBatch['previews'] = [];
  for (const preview of previews) {
    const candidateBatch = {
      previews: [...currentBatch, preview],
      requestId,
      type: 'preview-batch' as const,
    };
    if (currentBatch.length > 0 && getJsonByteLength(candidateBatch) > remotePreviewBatchMaxBytes) {
      batches.push({ previews: currentBatch, requestId, type: 'preview-batch' });
      currentBatch = [preview];
      continue;
    }
    currentBatch = candidateBatch.previews;
  }
  if (currentBatch.length > 0) {
    batches.push({ previews: currentBatch, requestId, type: 'preview-batch' });
  }
  return batches;
}

async function createSlidePreview(
  project: ProjectDocument,
  page: Page,
  hiddenElementIds = new Set<string>(),
): Promise<PresenterRemoteSlidePreview> {
  const backgroundAsset =
    page.background.type === 'asset' ? project.assets[page.background.assetId] : undefined;
  const elements: PresenterRemoteSlidePreviewElement[] = [];
  for (const elementId of page.elementIds) {
    if (hiddenElementIds.has(elementId)) continue;
    const element = project.elements[elementId];
    if (!element || element.visible === false) continue;
    elements.push(await createSlidePreviewElement(project, element));
  }
  return {
    backgroundColor:
      page.background.type === 'color' ? page.background.color : page.background.colorFallback,
    backgroundImageUrl: await createPreviewAssetUrl(backgroundAsset?.objectUrl),
    elements,
    height: page.height,
    width: page.width,
  };
}

function createElementFrame(element: DesignElement) {
  return {
    height: element.height,
    id: element.id,
    opacity: element.opacity,
    rotation: element.rotation,
    width: element.width,
    x: element.x,
    y: element.y,
  };
}

function createSlidePreviewElement(
  project: ProjectDocument,
  element: DesignElement,
): Promise<PresenterRemoteSlidePreviewElement> {
  const frame = createElementFrame(element);
  if (element.type === 'text') {
    return Promise.resolve({
      ...frame,
      align: element.align,
      fill: element.fill,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      kind: 'text',
      lineHeight: element.lineHeight,
      text: element.text,
      verticalAlign: element.verticalAlign,
    });
  }
  if (element.type === 'image') {
    return createPreviewAssetUrl(project.assets[element.assetId]?.objectUrl).then((assetUrl) => ({
      ...frame,
      assetUrl,
      kind: 'image',
    }));
  }
  if (element.type === 'gif' || element.type === 'video') {
    const asset = project.assets[element.assetId];
    const posterFrameSeconds =
      element.type === 'video'
        ? element.posterFrameSeconds ?? element.trimStartSeconds
        : undefined;
    return createPreviewMediaAssetUrl(asset?.objectUrl, element.type, posterFrameSeconds).then((assetUrl) => ({
      ...frame,
      assetUrl,
      autoplay:
        element.type === 'gif' ? element.playing : element.autoplayInPreview || element.playing,
      controls: element.type === 'video' ? element.controls : false,
      kind: 'media',
      loop: element.type === 'gif' ? element.playing : element.loop,
      mediaType: element.type,
      muted: element.type === 'video' ? element.muted : true,
    }));
  }
  return Promise.resolve({
    ...frame,
    fill: element.fill,
    kind: 'shape',
    shape: element.shape,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
  });
}

async function createPreviewAssetUrl(assetUrl: string | undefined) {
  if (!assetUrl) return undefined;
  if (isTestRuntime() && (assetUrl.startsWith('blob:') || assetUrl.startsWith('data:'))) {
    return undefined;
  }
  if (assetUrl.startsWith('data:image/')) {
    if (assetUrl.length <= remotePreviewMaxInlineAssetLength) return assetUrl;
    return createThumbnailDataUrl(assetUrl).catch(() => undefined);
  }
  if (assetUrl.startsWith('data:')) return undefined;
  if (assetUrl.startsWith('blob:')) {
    return createThumbnailDataUrl(assetUrl).catch(() => undefined);
  }
  return assetUrl;
}

async function createPreviewMediaAssetUrl(
  assetUrl: string | undefined,
  mediaType: 'gif' | 'video',
  posterFrameSeconds: number | undefined,
) {
  if (!assetUrl) return undefined;
  if (mediaType === 'gif') return createPreviewAssetUrl(assetUrl);
  if (isTestRuntime() && /^https?:\/\//.test(assetUrl)) {
    return undefined;
  }
  if (assetUrl.startsWith('data:image/')) return createPreviewAssetUrl(assetUrl);
  if (assetUrl.startsWith('data:') || assetUrl.startsWith('blob:') || /^https?:\/\//.test(assetUrl)) {
    return createVideoThumbnailDataUrl(assetUrl, posterFrameSeconds).catch(() => undefined);
  }
  return undefined;
}

function createThumbnailDataUrl(assetUrl: string) {
  if (typeof document === 'undefined') return Promise.resolve(undefined);
  return new Promise<string | undefined>((resolve) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => resolve(undefined), 250);
    image.onload = () => {
      window.clearTimeout(timeoutId);
      try {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        if (!sourceWidth || !sourceHeight) {
          resolve(undefined);
          return;
        }
        const scale = Math.min(
          1,
          remotePreviewThumbnailMaxEdge / Math.max(sourceWidth, sourceHeight),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(undefined);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', remotePreviewThumbnailQuality));
      } catch (error) {
        presenterRemoteDebugLog.warn('Remote preview thumbnail generation failed.', error);
        resolve(undefined);
      }
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      presenterRemoteDebugLog.warn('Remote preview thumbnail image failed to load.');
      resolve(undefined);
    };
    image.src = assetUrl;
  });
}

function createVideoThumbnailDataUrl(assetUrl: string, posterFrameSeconds: number | undefined) {
  if (typeof document === 'undefined') return Promise.resolve(undefined);
  return new Promise<string | undefined>((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      finish(undefined);
    }, 1500);

    function cleanup() {
      window.clearTimeout(timeoutId);
      video.onerror = null;
      video.onloadeddata = null;
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        // Some test and embedded browser media implementations expose load() without implementing it.
      }
    }

    function finish(dataUrl: string | undefined) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(dataUrl);
    }

    function resolveWithFrame() {
      try {
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        if (!sourceWidth || !sourceHeight) {
          finish(undefined);
          return;
        }
        const scale = Math.min(
          1,
          remotePreviewThumbnailMaxEdge / Math.max(sourceWidth, sourceHeight),
        );
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          finish(undefined);
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/jpeg', remotePreviewThumbnailQuality));
      } catch (error) {
        presenterRemoteDebugLog.warn('Remote preview video thumbnail generation failed.', error);
        finish(undefined);
      }
    }

    function handleLoadedMetadata() {
      const targetTime = Math.max(0, posterFrameSeconds ?? 0);
      if (!Number.isFinite(targetTime) || Math.abs(video.currentTime - targetTime) < 0.05) {
        resolveWithFrame();
        return;
      }
      try {
        video.currentTime = Math.min(targetTime, video.duration || targetTime);
      } catch {
        resolveWithFrame();
      }
    }

    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.onloadedmetadata = handleLoadedMetadata;
    video.onseeked = resolveWithFrame;
    video.onloadeddata = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.currentTime === 0) {
        resolveWithFrame();
      }
    };
    video.onerror = () => {
      presenterRemoteDebugLog.warn('Remote preview video thumbnail failed to load.');
      finish(undefined);
    };
    video.src = assetUrl;
    video.load();
  });
}

function getJsonByteLength(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
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
