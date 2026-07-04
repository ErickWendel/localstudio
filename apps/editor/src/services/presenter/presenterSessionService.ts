import type {
  PresenterCommandMessage,
  PresenterStateMessage,
  PresenterStatePayload,
  PresenterWindowCommand,
} from './presenterSessionTypes';

type OpenPresenterWindow = (url: string, target: string, features: string) => Window | null;

interface BrowserPresenterSessionServiceOptions {
  href?: string;
  openWindow?: OpenPresenterWindow;
  randomId?: () => string;
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
  private readonly targetWindow: Window;
  private popupWindow: Window | null = null;
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
    if (!this.sessionId || !this.popupWindow || this.popupWindow.closed) return;
    const message: PresenterStateMessage = {
      payload,
      sessionId: this.sessionId,
      source: 'localstudio-presenter-main',
      type: 'state',
    };
    this.popupWindow.postMessage(message, this.origin);
  }

  closePresenterWindow() {
    if (this.popupWindow && !this.popupWindow.closed) this.popupWindow.close();
    this.popupWindow = null;
    this.sessionId = undefined;
  }

  subscribeToCommands(handler: (command: PresenterWindowCommand) => void) {
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
      if (
        command === 'close' ||
        command === 'next' ||
        command === 'pause-timer' ||
        command === 'previous' ||
        command === 'request-state' ||
        command === 'reset-timer' ||
        command === 'resume-timer'
      ) {
        handler({ command });
      }
    };
    this.targetWindow.addEventListener('message', listener);
    return () => {
      this.targetWindow.removeEventListener('message', listener);
    };
  }
}
