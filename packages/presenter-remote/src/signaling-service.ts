import type { PresenterRemoteCommand, PresenterRemoteState, PresenterRemoteSession } from './protocol';
import { presenterRemoteSessionCode } from './session-code';

export interface PresenterRemoteSignalingServiceOptions {
  now?: (() => number) | undefined;
  randomCode?: (() => string) | undefined;
  randomId?: (() => string) | undefined;
}

export interface RegisterPresenterRemoteSessionInput {
  presenterLabel: string;
  ttlMs: number;
}

export interface ControllerOfferInput {
  offerSdp: string;
  sessionCode: string;
}

export type ControllerOfferResult = { status: 'not-found' } | { status: 'pending' };

interface StoredSession {
  answerSdp?: string | undefined;
  commands: PresenterRemoteCommand[];
  offerSdp?: string | undefined;
  publishedState?: PresenterRemoteState | undefined;
  session: PresenterRemoteSession;
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class InMemoryPresenterRemoteSignalingService {
  private readonly now: () => number;
  private readonly randomCode: () => string;
  private readonly randomId: () => string;
  private readonly sessions = new Map<string, StoredSession>();

  constructor(options: PresenterRemoteSignalingServiceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.randomCode = options.randomCode ?? presenterRemoteSessionCode.create;
    this.randomId = options.randomId ?? createSessionId;
  }

  registerSession(input: RegisterPresenterRemoteSessionInput): PresenterRemoteSession {
    this.pruneExpiredSessions();
    let code = presenterRemoteSessionCode.normalize(this.randomCode());
    while (this.sessions.has(code) || !presenterRemoteSessionCode.isValid(code)) {
      code = presenterRemoteSessionCode.create();
    }
    const session: PresenterRemoteSession = {
      code,
      connectedControllerCount: 0,
      expiresAt: new Date(this.now() + input.ttlMs).toISOString(),
      presenterLabel: input.presenterLabel,
      sessionId: this.randomId(),
    };
    this.sessions.set(code, { commands: [], session });
    return session;
  }

  listActiveSessions(): PresenterRemoteSession[] {
    this.pruneExpiredSessions();
    return Array.from(this.sessions.values(), ({ session }) => ({ ...session }));
  }

  getSingleActiveSession() {
    const activeSessions = this.listActiveSessions();
    return activeSessions.length === 1 ? activeSessions[0] : undefined;
  }

  lookupSession(sessionCode: string) {
    this.pruneExpiredSessions();
    const code = presenterRemoteSessionCode.normalize(sessionCode);
    return this.sessions.get(code)?.session;
  }

  createControllerOffer(input: ControllerOfferInput): ControllerOfferResult {
    this.pruneExpiredSessions();
    const code = presenterRemoteSessionCode.normalize(input.sessionCode);
    const storedSession = this.sessions.get(code);
    if (!storedSession) return { status: 'not-found' };
    storedSession.offerSdp = input.offerSdp;
    storedSession.answerSdp = undefined;
    return { status: 'pending' };
  }

  takePendingOffer(sessionCode: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    return storedSession?.offerSdp;
  }

  publishAnswer(sessionCode: string, answerSdp: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return false;
    storedSession.answerSdp = answerSdp;
    storedSession.session.connectedControllerCount += 1;
    return true;
  }

  getAnswer(sessionCode: string) {
    this.pruneExpiredSessions();
    return this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode))?.answerSdp;
  }

  publishState(sessionCode: string, state: PresenterRemoteState) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return false;
    storedSession.publishedState = {
      ...state,
      connectedControllerCount: storedSession.session.connectedControllerCount,
    };
    return true;
  }

  getPublishedState(sessionCode: string) {
    this.pruneExpiredSessions();
    return this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode))?.publishedState;
  }

  publishCommand(sessionCode: string, command: PresenterRemoteCommand) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return false;
    storedSession.commands.push(command);
    return true;
  }

  takeCommands(sessionCode: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return [];
    const commands = storedSession.commands;
    storedSession.commands = [];
    return commands;
  }

  closeSession(sessionCode: string) {
    return this.sessions.delete(presenterRemoteSessionCode.normalize(sessionCode));
  }

  private pruneExpiredSessions() {
    const now = this.now();
    for (const [code, storedSession] of this.sessions) {
      if (Date.parse(storedSession.session.expiresAt) <= now) this.sessions.delete(code);
    }
  }
}
