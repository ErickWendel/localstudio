import type { PresenterRemoteCommand, PresenterRemoteState, PresenterRemoteSession } from './protocol';
import { presenterRemoteSessionCode } from './session-code';
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
  presenterLabel: string;
  ttlMs: number;
}

export interface ControllerOfferInput {
  controllerId: string;
  offerSdp: string;
  sessionCode: string;
}

export type ControllerOfferResult = { status: 'not-found' } | { status: 'pending' };

interface StoredControllerConnection {
  answerSdp?: string | undefined;
  controllerIceCandidates: RTCIceCandidateInit[];
  offerSdp: string;
  presenterIceCandidates: RTCIceCandidateInit[];
}

interface StoredSession {
  commands: PresenterRemoteCommand[];
  publishedState?: PresenterRemoteState | undefined;
  session: PresenterRemoteSession;
  webRtcControllers: Map<string, StoredControllerConnection>;
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
    this.sessions.set(code, { commands: [], session, webRtcControllers: new Map() });
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
    storedSession.webRtcControllers.set(input.controllerId, {
      controllerIceCandidates: [],
      offerSdp: input.offerSdp,
      presenterIceCandidates: [],
    });
    return { status: 'pending' };
  }

  takePendingOffers(sessionCode: string): PresenterRemoteControllerOffer[] {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return [];
    return Array.from(storedSession.webRtcControllers.entries())
      .filter(([, connection]) => connection.answerSdp === undefined)
      .map(([controllerId, connection]) => ({ controllerId, offerSdp: connection.offerSdp }));
  }

  publishAnswer(sessionCode: string, controllerId: string, answerSdp: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return false;
    const connection = storedSession.webRtcControllers.get(controllerId);
    if (!connection) return false;
    connection.answerSdp = answerSdp;
    return true;
  }

  getAnswer(sessionCode: string, controllerId: string) {
    this.pruneExpiredSessions();
    return this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode))?.webRtcControllers.get(controllerId)
      ?.answerSdp;
  }

  publishIceCandidate(sessionCode: string, controllerId: string, message: PresenterRemoteIceCandidateMessage) {
    this.pruneExpiredSessions();
    const connection = this.sessions
      .get(presenterRemoteSessionCode.normalize(sessionCode))
      ?.webRtcControllers.get(controllerId);
    if (!connection) return false;
    if (message.target === 'presenter') connection.controllerIceCandidates.push(message.candidate);
    else connection.presenterIceCandidates.push(message.candidate);
    return true;
  }

  takeIceCandidates(sessionCode: string, controllerId: string, target: 'controller' | 'presenter') {
    this.pruneExpiredSessions();
    const connection = this.sessions
      .get(presenterRemoteSessionCode.normalize(sessionCode))
      ?.webRtcControllers.get(controllerId);
    if (!connection) return [];
    const candidates = target === 'presenter'
      ? connection.controllerIceCandidates
      : connection.presenterIceCandidates;
    if (target === 'presenter') connection.controllerIceCandidates = [];
    else connection.presenterIceCandidates = [];
    return candidates;
  }

  closeController(sessionCode: string, controllerId: string) {
    this.pruneExpiredSessions();
    const storedSession = this.sessions.get(presenterRemoteSessionCode.normalize(sessionCode));
    if (!storedSession) return false;
    const deleted = storedSession.webRtcControllers.delete(controllerId);
    storedSession.session.connectedControllerCount = Math.max(0, storedSession.session.connectedControllerCount - 1);
    return deleted;
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
