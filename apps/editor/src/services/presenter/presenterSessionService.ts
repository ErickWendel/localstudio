import type {
  DesignElement,
  Page,
  ProjectDocument,
} from '../../domain/documents/model';
import type {
  PresenterCommandMessage,
  PresenterRemoteSessionMetadata,
  PresenterStateMessage,
  PresenterStatePayload,
  PresenterWindowCommand,
} from './presenterSessionTypes';
import {
  InMemoryPresenterRemoteSignalingService,
  type RegisterPresenterRemoteSessionInput,
} from '@localstudio/presenter-remote/signaling-service';
import { PresenterRemoteSignalingClient } from '@localstudio/presenter-remote/signaling-client';
import type {
  PresenterRemoteCommand,
  PresenterRemoteSlidePreview,
  PresenterRemoteSlidePreviewElement,
  PresenterRemoteUpcomingSlidePreview,
  PresenterRemoteSession,
  PresenterRemoteState,
  PresenterRemoteTimerState,
} from '@localstudio/presenter-remote/protocol';

type OpenPresenterWindow = (url: string, target: string, features: string) => Window | null;
type ResolveRemoteControlOrigin = (origin: string) => Promise<string | undefined>;
type PresenterRemoteSignaling = {
  closeSession: (code: string) => boolean | Promise<unknown>;
  publishState: (code: string, state: PresenterRemoteState) => boolean | Promise<unknown>;
  registerSession: (input: RegisterPresenterRemoteSessionInput) => PresenterRemoteSession | Promise<PresenterRemoteSession>;
  takeCommands: (code: string) => PresenterRemoteCommand[] | Promise<PresenterRemoteCommand[]>;
};

interface BrowserPresenterSessionServiceOptions {
  href?: string;
  openWindow?: OpenPresenterWindow;
  randomId?: () => string;
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
  private readonly randomId: () => string;
  private readonly resolveRemoteControlOrigin: ResolveRemoteControlOrigin;
  private readonly remoteSignalingService: PresenterRemoteSignaling;
  private readonly targetWindow: Window;
  private popupWindow: Window | null = null;
  private portableAssetUrlCache = new Map<string, Promise<string | undefined>>();
  private presenterTimer: PresenterRemoteTimerState | undefined;
  private presenterTimerReceivedAt = 0;
  private lastPresenterPayload: PresenterStatePayload | undefined;
  private remoteSession: PresenterRemoteSessionMetadata | undefined;
  private remoteSessionStartedAt = 0;
  private remoteStatePublishSequence = 0;
  private sessionId: string | undefined;

  constructor(options: BrowserPresenterSessionServiceOptions = {}) {
    const targetWindow = options.targetWindow ?? window;
    this.targetWindow = targetWindow;
    this.href = options.href ?? targetWindow.location.href;
    this.origin = new URL(this.href).origin;
    this.openWindow =
      options.openWindow ??
      ((url, target, features) => targetWindow.open(url, target, features));
    this.randomId = options.randomId ?? createSessionId;
    this.resolveRemoteControlOrigin =
      options.resolveRemoteControlOrigin ?? resolveRemoteControlOrigin;
    this.remoteSignalingService =
      options.remoteSignalingService ?? createDefaultRemoteSignalingService();
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
    if (this.remoteSession) {
      const publishSequence = ++this.remoteStatePublishSequence;
      const sessionCode = this.remoteSession.code;
      void this.createRemoteState(
        payload,
        this.remoteSession.connectedControllerCount,
        this.remoteSessionStartedAt ? Date.now() - this.remoteSessionStartedAt : 0,
      ).then((remoteState) => {
        if (publishSequence !== this.remoteStatePublishSequence) return;
        void Promise.resolve(this.remoteSignalingService.publishState(sessionCode, remoteState));
      });
    }
  }

  closePresenterWindow() {
    if (this.popupWindow && !this.popupWindow.closed) this.popupWindow.close();
    this.popupWindow = null;
    if (this.remoteSession) void Promise.resolve(this.remoteSignalingService.closeSession(this.remoteSession.code));
    this.remoteSession = undefined;
    this.sessionId = undefined;
  }

  async openRemoteControlSession(input: RegisterPresenterRemoteSessionInput): Promise<PresenterRemoteSessionMetadata> {
    if (this.remoteSession) return this.remoteSession;
    const session = await this.remoteSignalingService.registerSession(input);
    const remoteOrigin = (await this.resolveRemoteControlOrigin(this.origin)) ?? this.origin;
    const qrUrl = new URL('/joystick', remoteOrigin);
    this.remoteSession = {
      ...session,
      qrUrl: qrUrl.toString(),
    };
    this.remoteSessionStartedAt = Date.now();
    return this.remoteSession;
  }

  getRemoteControlSession() {
    return this.remoteSession;
  }

  subscribeToCommands(handler: (command: PresenterWindowCommand) => void) {
    const handleRemoteCommand = (command: PresenterRemoteCommand) => {
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
    const remoteIntervalId = this.targetWindow.setInterval(() => {
      if (!this.remoteSession) return;
      if (takingRemoteCommands) return;
      takingRemoteCommands = true;
      void Promise.resolve(this.remoteSignalingService.takeCommands(this.remoteSession.code))
        .then((commands) => {
          for (const command of commands) {
            if (
              command.command === 'pause-timer' ||
              command.command === 'reset-timer' ||
              command.command === 'resume-timer'
            ) {
              this.postPresenterCommand(command);
            }
            handleRemoteCommand(command);
          }
        })
        .finally(() => {
          takingRemoteCommands = false;
        });
    }, 250);
    return () => {
      this.targetWindow.removeEventListener('message', listener);
      this.targetWindow.clearInterval(remoteIntervalId);
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

  private async createRemoteState(
    payload: PresenterStatePayload,
    connectedControllerCount: number,
    elapsedMs: number,
  ) {
    return createRemoteState(
      payload,
      connectedControllerCount,
      this.getCurrentPresenterTimer(payload.timer, elapsedMs),
      (assetUrl) => this.getPortableAssetUrl(assetUrl),
    );
  }

  private getCurrentPresenterTimer(payloadTimer: PresenterRemoteTimerState | undefined, elapsedMs: number) {
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

  private getPortableAssetUrl(assetUrl: string | undefined) {
    if (!assetUrl?.startsWith('blob:')) return Promise.resolve(assetUrl);
    const cachedAssetUrl = this.portableAssetUrlCache.get(assetUrl);
    if (cachedAssetUrl) return cachedAssetUrl;
    const portableAssetUrl = objectUrlToDataUrl(assetUrl).catch(() => undefined);
    this.portableAssetUrlCache.set(assetUrl, portableAssetUrl);
    return portableAssetUrl;
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

async function objectUrlToDataUrl(objectUrl: string) {
  const response = await fetch(objectUrl);
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
  });
}

function createDefaultRemoteSignalingService(): PresenterRemoteSignaling {
  if (!isTestRuntime() && typeof fetch === 'function') {
    return new PresenterRemoteSignalingClient({ endpoint: '/__localstudio/presenter-remote' });
  }
  return new InMemoryPresenterRemoteSignalingService();
}

function isTestRuntime() {
  return import.meta.env.MODE === 'test';
}

function createRemoteState(
  payload: PresenterStatePayload,
  connectedControllerCount: number,
  timer: PresenterRemoteTimerState,
  resolvePortableAssetUrl: (assetUrl: string | undefined) => Promise<string | undefined>,
): Promise<PresenterRemoteState> {
  const activePageIndex = Math.max(
    0,
    payload.project.pages.findIndex((page) => page.id === payload.activePageId),
  );
  const activePage = payload.project.pages[activePageIndex] ?? payload.project.pages[0];
  const nextPage = payload.project.pages[activePageIndex + 1];
  const upcomingPages = payload.project.pages.slice(activePageIndex + 1, activePageIndex + 4);
  const hiddenElementIds =
    activePage && payload.animationPreview?.pageId === activePage.id
      ? new Set(payload.animationPreview.hiddenElementIds)
      : undefined;
  return Promise.all([
    activePage ? createSlidePreview(payload.project, activePage, resolvePortableAssetUrl, hiddenElementIds) : undefined,
    nextPage ? createSlidePreview(payload.project, nextPage, resolvePortableAssetUrl) : undefined,
    createUpcomingSlidePreviews(payload.project, upcomingPages, resolvePortableAssetUrl),
  ]).then(([slidePreview, nextSlidePreview, upcomingSlidePreviews]) => ({
    activePageId: activePage?.id ?? payload.activePageId,
    activePageIndex,
    activePageName: activePage?.name,
    buildsRemaining: activePage ? getRemoteBuildsRemaining(payload, activePage) : 0,
    connectedControllerCount,
    deckName: payload.project.name,
    nextPageName: nextPage?.name,
    nextSlidePreview,
    notes: activePage?.speakerNotes ?? '',
    pageCount: payload.project.pages.length,
    pages: payload.project.pages.map((page) => ({ id: page.id, name: page.name })),
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
    slidePreview,
    shortcuts: ['previous', 'next', 'pause-timer', 'reset-timer'],
    stream: { enabled: true, fps: 8, height: 844, width: 390 },
    timer,
    type: 'state',
    upcomingSlidePreviews,
  }));
}

function getRemoteBuildsRemaining(payload: PresenterStatePayload, page: Page) {
  const validBuilds = (page.animationBuilds ?? []).filter((build) =>
    page.elementIds.includes(build.elementId),
  );
  if (validBuilds.length === 0) return 0;
  if (payload.animationPreview?.pageId !== page.id) return validBuilds.length;
  if (payload.animationPreview.phase === 'complete') return 0;
  const hiddenElementIds = new Set(payload.animationPreview.hiddenElementIds);
  return validBuilds.filter((build) => hiddenElementIds.has(build.elementId)).length;
}

function createUpcomingSlidePreviews(
  project: ProjectDocument,
  pages: Page[],
  resolvePortableAssetUrl: (assetUrl: string | undefined) => Promise<string | undefined>,
): Promise<PresenterRemoteUpcomingSlidePreview[]> {
  return Promise.all(
    pages.map((page) =>
      createSlidePreview(project, page, resolvePortableAssetUrl).then((preview) => ({
        pageId: page.id,
        pageName: page.name,
        preview,
      })),
    ),
  );
}

async function createSlidePreview(
  project: ProjectDocument,
  page: Page,
  resolvePortableAssetUrl: (assetUrl: string | undefined) => Promise<string | undefined>,
  hiddenElementIds = new Set<string>(),
): Promise<PresenterRemoteSlidePreview> {
  const backgroundAsset =
    page.background.type === 'asset' ? project.assets[page.background.assetId] : undefined;
  const elements: PresenterRemoteSlidePreviewElement[] = [];
  for (const elementId of page.elementIds) {
    if (hiddenElementIds.has(elementId)) continue;
    const element = project.elements[elementId];
    if (!element || element.visible === false) continue;
    elements.push(await createSlidePreviewElement(project, element, resolvePortableAssetUrl));
  }
  return {
    backgroundColor:
      page.background.type === 'color' ? page.background.color : page.background.colorFallback,
    backgroundImageUrl: await resolvePortableAssetUrl(backgroundAsset?.objectUrl),
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
  resolvePortableAssetUrl: (assetUrl: string | undefined) => Promise<string | undefined>,
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
    return resolvePortableAssetUrl(project.assets[element.assetId]?.objectUrl).then((assetUrl) => ({
      ...frame,
      assetUrl,
      kind: 'image',
    }));
  }
  if (element.type === 'gif' || element.type === 'video') {
    return Promise.resolve({
      ...frame,
      autoplay: element.type === 'gif' ? element.playing : element.autoplayInPreview || element.playing,
      controls: element.type === 'video' ? element.controls : false,
      kind: 'media',
      loop: element.type === 'gif' ? element.playing : element.loop,
      mediaType: element.type,
      muted: element.type === 'video' ? element.muted : true,
    });
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

function isLoopbackOrigin(origin: string) {
  const hostname = new URL(origin).hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0';
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
    const payload = await response.json() as { origin?: unknown };
    return isValidRemoteOrigin(payload.origin) ? payload.origin : origin;
  } catch {
    return origin;
  }
}
