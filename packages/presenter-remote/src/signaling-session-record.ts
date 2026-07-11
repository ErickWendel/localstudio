import type { PresenterRemoteCommand, PresenterRemoteState, PresenterRemoteSession } from './protocol';
import type {
  PresenterRemoteControllerOffer,
  PresenterRemoteIceCandidateMessage,
} from './webrtc';

interface StoredControllerConnection {
  answerSdp?: string | undefined;
  controllerIceCandidates: RTCIceCandidateInit[];
  offerSdp: string;
  presenterIceCandidates: RTCIceCandidateInit[];
}

export class PresenterRemoteSignalingSessionRecord {
  private commands: PresenterRemoteCommand[] = [];
  private readonly connectedControllers = new Set<string>();
  private publishedState: PresenterRemoteState | undefined;
  private readonly session: PresenterRemoteSession;
  private readonly trustedControllers = new Set<string>();
  private readonly webRtcControllers = new Map<string, StoredControllerConnection>();

  constructor(session: PresenterRemoteSession) {
    this.session = session;
  }

  getSession(): PresenterRemoteSession {
    return { ...this.session };
  }

  isExpired(now: number) {
    return Date.parse(this.session.expiresAt) <= now;
  }

  connectController(controllerId: string) {
    if (!controllerId) return undefined;
    this.connectedControllers.add(controllerId);
    this.trustedControllers.add(controllerId);
    this.refreshConnectedControllerCount();
    return this.getSession();
  }

  createControllerOffer(controllerId: string, offerSdp: string) {
    if (!this.trustedControllers.has(controllerId)) return { status: 'not-found' } as const;
    this.webRtcControllers.set(controllerId, {
      controllerIceCandidates: [],
      offerSdp,
      presenterIceCandidates: [],
    });
    return { status: 'pending' } as const;
  }

  takePendingOffers(): PresenterRemoteControllerOffer[] {
    return Array.from(this.webRtcControllers.entries())
      .filter(([, connection]) => connection.answerSdp === undefined)
      .map(([controllerId, connection]) => ({ controllerId, offerSdp: connection.offerSdp }));
  }

  publishAnswer(controllerId: string, answerSdp: string) {
    const connection = this.webRtcControllers.get(controllerId);
    if (!connection) return false;
    connection.answerSdp = answerSdp;
    return true;
  }

  getAnswer(controllerId: string) {
    return this.webRtcControllers.get(controllerId)?.answerSdp;
  }

  publishIceCandidate(controllerId: string, message: PresenterRemoteIceCandidateMessage) {
    const connection = this.webRtcControllers.get(controllerId);
    if (!connection) return false;
    if (message.target === 'presenter') connection.controllerIceCandidates.push(message.candidate);
    else connection.presenterIceCandidates.push(message.candidate);
    return true;
  }

  takeIceCandidates(controllerId: string, target: 'controller' | 'presenter') {
    const connection = this.webRtcControllers.get(controllerId);
    if (!connection) return [];
    const candidates =
      target === 'presenter' ? connection.controllerIceCandidates : connection.presenterIceCandidates;
    if (target === 'presenter') connection.controllerIceCandidates = [];
    else connection.presenterIceCandidates = [];
    return candidates;
  }

  closeController(controllerId: string) {
    this.webRtcControllers.delete(controllerId);
    this.connectedControllers.delete(controllerId);
    this.refreshConnectedControllerCount();
    return true;
  }

  publishState(state: PresenterRemoteState) {
    this.publishedState = {
      ...state,
      connectedControllerCount: this.session.connectedControllerCount,
    };
  }

  getPublishedState() {
    return this.publishedState;
  }

  publishCommand(command: PresenterRemoteCommand, controllerId?: string) {
    if (controllerId !== undefined && !this.trustedControllers.has(controllerId)) return false;
    this.commands.push(command);
    return true;
  }

  takeCommands() {
    const commands = this.commands;
    this.commands = [];
    return commands;
  }

  private refreshConnectedControllerCount() {
    this.session.connectedControllerCount = this.connectedControllers.size;
  }
}
