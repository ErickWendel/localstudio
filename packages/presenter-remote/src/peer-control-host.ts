import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import {
  presenterRemoteProtocol,
  type PresenterRemoteCommand,
  type PresenterRemoteSession,
  type PresenterRemoteState,
} from './protocol';

export interface PresenterRemotePeerSession extends PresenterRemoteSession {
  controlPeerId: string;
  transport: 'peerjs';
}

export interface PresenterRemotePeerControlHostOptions {
  connectionTimeoutMs?: number | undefined;
  now?: (() => number) | undefined;
  onCommand?: ((command: PresenterRemoteCommand) => void) | undefined;
  peerFactory?: (() => Peer) | undefined;
  peerOptions?: PeerOptions | undefined;
  presenterDeviceId?: string | undefined;
  presenterLabel: string;
  ttlMs: number;
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `peer-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function oncePeerOpen(peer: Peer) {
  if (peer.open && peer.id) return Promise.resolve(peer.id);
  return new Promise<string>((resolve, reject) => {
    peer.on('open', resolve);
    peer.on('error', reject);
  });
}

function rejectAfter(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('PeerJS host connection timed out.')), timeoutMs);
  });
}

export class PresenterRemotePeerControlHost {
  private readonly connections = new Set<DataConnection>();
  private readonly now: () => number;
  private readonly onCommand: ((command: PresenterRemoteCommand) => void) | undefined;
  private readonly options: PresenterRemotePeerControlHostOptions;
  private lastState: PresenterRemoteState | undefined;
  private peer: Peer | undefined;
  private session: PresenterRemotePeerSession | undefined;

  constructor(options: PresenterRemotePeerControlHostOptions) {
    this.now = options.now ?? Date.now;
    this.onCommand = options.onCommand;
    this.options = options;
  }

  async open(): Promise<PresenterRemotePeerSession> {
    if (this.session) return this.session;
    const peer = this.options.peerFactory?.() ??
      (this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer());
    this.peer = peer;
    peer.on('connection', (connection) => this.registerConnection(connection));
    const controlPeerId = await Promise.race([
      oncePeerOpen(peer),
      rejectAfter(this.options.connectionTimeoutMs ?? 12_000),
    ]);
    this.session = {
      code: controlPeerId,
      connectedControllerCount: 0,
      controlPeerId,
      expiresAt: new Date(this.now() + this.options.ttlMs).toISOString(),
      presenterDeviceId: this.options.presenterDeviceId ?? this.options.presenterLabel,
      presenterLabel: this.options.presenterLabel,
      sessionId: createSessionId(),
      transport: 'peerjs',
    };
    return this.session;
  }

  publishState(state: PresenterRemoteState) {
    this.lastState = {
      ...state,
      connectedControllerCount: this.connections.size,
    };
    for (const connection of this.connections) {
      if (connection.open) void connection.send(this.lastState);
    }
  }

  close() {
    for (const connection of this.connections) connection.close();
    this.connections.clear();
    this.peer?.destroy();
    this.peer = undefined;
    this.session = undefined;
    this.lastState = undefined;
  }

  private registerConnection(connection: DataConnection) {
    const addConnection = () => {
      this.connections.add(connection);
      if (this.lastState) {
        void connection.send({
          ...this.lastState,
          connectedControllerCount: this.connections.size,
        });
      }
    };
    connection.on('open', addConnection);
    if (connection.open) addConnection();
    connection.on('data', (data) => {
      if (!presenterRemoteProtocol.isCommand(data)) return;
      if (data.command === 'request-state' && this.lastState && connection.open) {
        void connection.send({
          ...this.lastState,
          connectedControllerCount: this.connections.size,
        });
      }
      this.onCommand?.(data);
    });
    const removeConnection = () => {
      this.connections.delete(connection);
    };
    connection.on('close', removeConnection);
    connection.on('error', removeConnection);
  }
}
