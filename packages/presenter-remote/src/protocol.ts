export type PresenterRemoteCommand =
  | { command: 'close'; type: 'command' }
  | { command: 'go-to-page'; pageId: string; type: 'command' }
  | { command: 'next'; type: 'command' }
  | { command: 'pause-timer'; type: 'command' }
  | { command: 'previous'; type: 'command' }
  | { command: 'request-previews'; pageIds: string[]; requestId?: string; type: 'command' }
  | { command: 'request-state'; type: 'command' }
  | { command: 'reset-timer'; type: 'command' }
  | { command: 'resume-timer'; type: 'command' }
  | { command: 'start-presenting'; type: 'command' }
  | { command: 'update-notes'; notes: string; pageId: string; type: 'command' };

export interface PresenterRemoteTimerState {
  elapsedMs: number;
  paused: boolean;
  updatedAtEpochMs?: number | undefined;
}

export type PresenterRemoteSlidePreviewElement =
  | {
      align: 'center' | 'left' | 'right';
      fill: string;
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      height: number;
      hyperlink?: string | undefined;
      id: string;
      kind: 'text';
      lineHeight?: number | undefined;
      opacity: number;
      rotation: number;
      text: string;
      verticalAlign?: 'bottom' | 'middle' | 'top' | undefined;
      width: number;
      x: number;
      y: number;
    }
  | {
      assetUrl?: string | undefined;
      autoplay?: boolean | undefined;
      controls?: boolean | undefined;
      height: number;
      id: string;
      kind: 'image' | 'media';
      loop?: boolean | undefined;
      mediaType?: 'gif' | 'video' | undefined;
      muted?: boolean | undefined;
      opacity: number;
      rotation: number;
      width: number;
      x: number;
      y: number;
    }
  | {
      fill?: string | undefined;
      height: number;
      id: string;
      kind: 'shape';
      opacity: number;
      rotation: number;
      shape: string;
      stroke?: string | undefined;
      strokeWidth?: number | undefined;
      width: number;
      x: number;
      y: number;
    };

export interface PresenterRemoteSlidePreview {
  backgroundColor: string;
  backgroundImageUrl?: string | undefined;
  elements: PresenterRemoteSlidePreviewElement[];
  height: number;
  width: number;
}

export interface PresenterRemotePageSummary {
  id: string;
  name: string;
  preview?: PresenterRemoteSlidePreview | undefined;
}

export interface PresenterRemoteUpcomingSlidePreview {
  pageId: string;
  pageName: string;
  preview?: PresenterRemoteSlidePreview | undefined;
}

export interface PresenterRemoteState {
  activePageId: string;
  activePageIndex: number;
  activePageName?: string | undefined;
  builds?:
    | {
        current: number;
        remaining: number;
        total: number;
      }
    | undefined;
  buildsRemaining: number;
  commandAvailability?: string[] | undefined;
  connectedControllerCount: number;
  deckName: string;
  nextPageName?: string | undefined;
  nextSlidePreview?: PresenterRemoteSlidePreview | undefined;
  notes: string;
  pageCount: number;
  pages?: PresenterRemotePageSummary[] | undefined;
  previewMode?: 'stream' | 'structured-fallback' | undefined;
  presenterMode: 'presenting' | 'ready';
  slidePreview?: PresenterRemoteSlidePreview | undefined;
  shortcuts: string[];
  stream?:
    | {
        enabled: boolean;
        fps: number;
        height: number;
        peerId?: string | undefined;
        transport?: 'peerjs' | undefined;
        width: number;
      }
    | undefined;
  timer: PresenterRemoteTimerState;
  type: 'state';
  upcomingSlidePreviews?: PresenterRemoteUpcomingSlidePreview[] | undefined;
}

export interface PresenterRemotePreviewBatch {
  previews: PresenterRemotePageSummary[];
  requestId?: string | undefined;
  type: 'preview-batch';
}

export type PresenterRemoteMessage = PresenterRemotePreviewBatch | PresenterRemoteState;

export interface PresenterRemoteSession {
  code: string;
  connectedControllerCount: number;
  expiresAt: string;
  presenterDeviceId: string;
  presenterLabel: string;
  sessionId: string;
}

export interface PresenterRemotePeerSession extends PresenterRemoteSession {
  controlPeerId: string;
  transport: 'peerjs';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isStreamMetadata(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.enabled === 'boolean' &&
    typeof value.fps === 'number' &&
    typeof value.height === 'number' &&
    (value.peerId === undefined || typeof value.peerId === 'string') &&
    (value.transport === undefined || value.transport === 'peerjs') &&
    typeof value.width === 'number'
  );
}

function isPageSummary(value: unknown): value is PresenterRemotePageSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    (value.preview === undefined || isSlidePreview(value.preview))
  );
}

function isUpcomingSlidePreview(value: unknown): value is PresenterRemoteUpcomingSlidePreview {
  return (
    isRecord(value) &&
    typeof value.pageId === 'string' &&
    typeof value.pageName === 'string' &&
    (value.preview === undefined || isSlidePreview(value.preview))
  );
}

function isPreviewElement(value: unknown): value is PresenterRemoteSlidePreviewElement {
  if (!isRecord(value)) return false;
  const hasCommonFrame =
    typeof value.id === 'string' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    typeof value.rotation === 'number' &&
    typeof value.opacity === 'number';
  if (!hasCommonFrame || typeof value.kind !== 'string') return false;
  if (value.kind === 'text') {
    return (
      typeof value.text === 'string' &&
      typeof value.fontFamily === 'string' &&
      typeof value.fontSize === 'number' &&
      typeof value.fontWeight === 'number' &&
      typeof value.fill === 'string' &&
      (value.hyperlink === undefined || typeof value.hyperlink === 'string') &&
      (value.align === 'left' || value.align === 'center' || value.align === 'right')
    );
  }
  if (value.kind === 'image' || value.kind === 'media') {
    return (
      (value.assetUrl === undefined || typeof value.assetUrl === 'string') &&
      (value.autoplay === undefined || typeof value.autoplay === 'boolean') &&
      (value.controls === undefined || typeof value.controls === 'boolean') &&
      (value.loop === undefined || typeof value.loop === 'boolean') &&
      (value.mediaType === undefined || value.mediaType === 'gif' || value.mediaType === 'video') &&
      (value.muted === undefined || typeof value.muted === 'boolean')
    );
  }
  if (value.kind === 'shape') return typeof value.shape === 'string';
  return false;
}

function isSlidePreview(value: unknown): value is PresenterRemoteSlidePreview {
  if (!isRecord(value)) return false;
  return (
    typeof value.backgroundColor === 'string' &&
    (value.backgroundImageUrl === undefined || typeof value.backgroundImageUrl === 'string') &&
    Array.isArray(value.elements) &&
    value.elements.every(isPreviewElement) &&
    typeof value.height === 'number' &&
    typeof value.width === 'number'
  );
}

function isCommand(value: unknown): value is PresenterRemoteCommand {
  if (!isRecord(value) || value.type !== 'command' || typeof value.command !== 'string')
    return false;
  if (
    value.command === 'close' ||
    value.command === 'next' ||
    value.command === 'pause-timer' ||
    value.command === 'previous' ||
    value.command === 'request-state' ||
    value.command === 'reset-timer' ||
    value.command === 'resume-timer' ||
    value.command === 'start-presenting'
  ) {
    return true;
  }
  if (value.command === 'go-to-page') return typeof value.pageId === 'string';
  if (value.command === 'request-previews') {
    return (
      Array.isArray(value.pageIds) &&
      value.pageIds.every((pageId) => typeof pageId === 'string') &&
      (value.requestId === undefined || typeof value.requestId === 'string')
    );
  }
  if (value.command === 'update-notes') {
    return typeof value.pageId === 'string' && typeof value.notes === 'string';
  }
  return false;
}

function isState(value: unknown): value is PresenterRemoteState {
  if (!isRecord(value) || value.type !== 'state') return false;
  if (!isRecord(value.timer)) return false;
  return (
    typeof value.activePageId === 'string' &&
    typeof value.activePageIndex === 'number' &&
    (value.activePageName === undefined || typeof value.activePageName === 'string') &&
    (value.builds === undefined ||
      (isRecord(value.builds) &&
        typeof value.builds.current === 'number' &&
        typeof value.builds.remaining === 'number' &&
        typeof value.builds.total === 'number')) &&
    typeof value.buildsRemaining === 'number' &&
    (value.commandAvailability === undefined || isStringArray(value.commandAvailability)) &&
    typeof value.connectedControllerCount === 'number' &&
    typeof value.deckName === 'string' &&
    (value.nextPageName === undefined || typeof value.nextPageName === 'string') &&
    (value.nextSlidePreview === undefined || isSlidePreview(value.nextSlidePreview)) &&
    typeof value.notes === 'string' &&
    typeof value.pageCount === 'number' &&
    (value.pages === undefined ||
      (Array.isArray(value.pages) && value.pages.every(isPageSummary))) &&
    (value.previewMode === undefined ||
      value.previewMode === 'stream' ||
      value.previewMode === 'structured-fallback') &&
    (value.presenterMode === 'presenting' || value.presenterMode === 'ready') &&
    (value.slidePreview === undefined || isSlidePreview(value.slidePreview)) &&
    isStringArray(value.shortcuts) &&
    (value.stream === undefined || isStreamMetadata(value.stream)) &&
    typeof value.timer.elapsedMs === 'number' &&
    typeof value.timer.paused === 'boolean' &&
    (value.timer.updatedAtEpochMs === undefined ||
      typeof value.timer.updatedAtEpochMs === 'number') &&
    (value.upcomingSlidePreviews === undefined ||
      (Array.isArray(value.upcomingSlidePreviews) &&
        value.upcomingSlidePreviews.every(isUpcomingSlidePreview)))
  );
}

function isPreviewBatch(value: unknown): value is PresenterRemotePreviewBatch {
  return (
    isRecord(value) &&
    value.type === 'preview-batch' &&
    Array.isArray(value.previews) &&
    value.previews.every(isPageSummary) &&
    (value.requestId === undefined || typeof value.requestId === 'string')
  );
}

function isSession(value: unknown): value is PresenterRemoteSession {
  if (!isRecord(value)) return false;
  return (
    typeof value.code === 'string' &&
    typeof value.connectedControllerCount === 'number' &&
    typeof value.expiresAt === 'string' &&
    typeof value.presenterDeviceId === 'string' &&
    typeof value.presenterLabel === 'string' &&
    typeof value.sessionId === 'string'
  );
}

export const presenterRemoteProtocol = {
  isCommand,
  isPreviewBatch,
  isSession,
  isState,
} as const;
