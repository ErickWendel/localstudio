import type { PresenterRemoteCommand, PresenterRemoteState, PresenterRemoteSession } from './protocol';
import { presenterRemoteSessionCode } from './session-code.ts';
import { PresenterRemoteSignalingSessionRecord } from './signaling-session-record.ts';
import type {
  PresenterRemoteControllerOffer,
  PresenterRemoteIceCandidateMessage,
} from './webrtc';

export interface PresenterRemoteSignalingServiceOptions {
  now?: (() => number) | undefined;
  randomCode?: (() => string) | undefined;
  randomId?: (() => string) | undefined;
}

export interface RegisterPresenterRemoteSessionInput {
  presenterDeviceId?: string | undefined;
  presenterLabel: string;
  ttlMs: number;
}

export interface ControllerOfferInput {
  controllerId: string;
  offerSdp: string;
  sessionCode: string;
}

export type ControllerOfferResult = { status: 'not-found' } | { status: 'pending' };

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class InMemoryPresenterRemoteSignalingService {
  private readonly now: () => number;
  private readonly randomCode: () => string;
  private readonly randomId: () => string;
  private readonly sessions = new Map<string, PresenterRemoteSignalingSessionRecord>();

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
      presenterDeviceId: input.presenterDeviceId ?? input.presenterLabel,
      presenterLabel: input.presenterLabel,
      sessionId: this.randomId(),
    };
    this.sessions.set(code, new PresenterRemoteSignalingSessionRecord(session));
    return session;
  }

  listActiveSessions(): PresenterRemoteSession[] {
    this.pruneExpiredSessions();
    return Array.from(this.sessions.values(), (storedSession) => storedSession.getSession());
  }

  listSessions(): PresenterRemoteSession[] {
    return this.listActiveSessions();
  }

  getSingleActiveSession() {
    const activeSessions = this.listActiveSessions();
    return activeSessions.length === 1 ? activeSessions[0] : undefined;
  }

  lookupSession(sessionCode: string) {
    this.pruneExpiredSessions();
    const code = presenterRemoteSessionCode.normalize(sessionCode);
    return this.sessions.get(code)?.getSession();
  }

  connectController(sessionCode: string, controllerId: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    return storedSession?.connectController(controllerId);
  }

  createControllerOffer(input: ControllerOfferInput): ControllerOfferResult {
    this.pruneExpiredSessions();
    const code = presenterRemoteSessionCode.normalize(input.sessionCode);
    const storedSession = this.sessions.get(code);
    if (!storedSession) return { status: 'not-found' };
    return storedSession.createControllerOffer(input.controllerId, input.offerSdp);
  }

  takePendingOffers(sessionCode: string): PresenterRemoteControllerOffer[] {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    return storedSession?.takePendingOffers() ?? [];
  }

  publishAnswer(sessionCode: string, controllerId: string, answerSdp: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    return storedSession?.publishAnswer(controllerId, answerSdp) ?? false;
  }

  getAnswer(sessionCode: string, controllerId: string) {
    this.pruneExpiredSessions();
    return this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode))?.getAnswer(controllerId);
  }

  publishIceCandidate(sessionCode: string, controllerId: string, message: PresenterRemoteIceCandidateMessage) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    return storedSession?.publishIceCandidate(controllerId, message) ?? false;
  }

  takeIceCandidates(sessionCode: string, controllerId: string, target: 'controller' | 'presenter') {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    return storedSession?.takeIceCandidates(controllerId, target) ?? [];
  }

  closeController(sessionCode: string, controllerId: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return false;
    return storedSession.closeController(controllerId);
  }

  publishState(sessionCode: string, state: PresenterRemoteState) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return false;
    storedSession.publishState(state);
    return true;
  }

  getPublishedState(sessionCode: string) {
    this.pruneExpiredSessions();
    return this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode))?.getPublishedState();
  }

  publishCommand(sessionCode: string, command: PresenterRemoteCommand, controllerId?: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return false;
    return storedSession.publishCommand(command, controllerId);
  }

  takeCommands(sessionCode: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    return storedSession?.takeCommands() ?? [];
  }

  closeSession(sessionCode: string) {
    return this.sessions.delete(presenterRemoteSessionCode.normalize(sessionCode));
  }

  private pruneExpiredSessions() {
    const now = this.now();
    for (const [code, storedSession] of this.sessions) {
      if (storedSession.isExpired(now)) this.sessions.delete(code);
    }
  }
}
