import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import {
  presenterRemoteProtocol,
  type PresenterRemoteCommand,
  type PresenterRemoteState,
} from './protocol';

export interface PresenterRemotePeerControlClientOptions {
  connectionTimeoutMs?: number | undefined;
  onState: (state: PresenterRemoteState) => void;
  onStatusChange?: ((status: 'connected' | 'connecting' | 'failed') => void) | undefined;
  peerFactory?: (() => Peer) | undefined;
  peerOptions?: PeerOptions | undefined;
  presenterPeerId: string;
}

function oncePeerOpen(peer: Peer) {
  if (peer.open) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve());
    peer.on('error', reject);
  });
}

function rejectAfter(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('PeerJS connection timed out.')), timeoutMs);
  });
}

export class PresenterRemotePeerControlClient {
  private connection: DataConnection | undefined;
  private readonly options: PresenterRemotePeerControlClientOptions;
  private peer: Peer | undefined;

  constructor(options: PresenterRemotePeerControlClientOptions) {
    this.options = options;
  }

  async start() {
    if (this.connection) return;
    this.options.onStatusChange?.('connecting');
    const peer = this.options.peerFactory?.() ??
      (this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer());
    this.peer = peer;
    const timeoutMs = this.options.connectionTimeoutMs ?? 12_000;
    await Promise.race([oncePeerOpen(peer), rejectAfter(timeoutMs)]).catch((error: unknown) => {
      this.options.onStatusChange?.('failed');
      throw error;
    });
    const connection = peer.connect(this.options.presenterPeerId, {
      label: 'localstudio-presenter-control',
      serialization: 'json',
    });
    this.connection = connection;
    let connectionOpened = false;
    const timeoutId = window.setTimeout(() => {
      if (connectionOpened) return;
      this.options.onStatusChange?.('failed');
      connection.close();
    }, timeoutMs);
    const handleConnectionOpen = () => {
      if (connectionOpened) return;
      connectionOpened = true;
      window.clearTimeout(timeoutId);
      this.options.onStatusChange?.('connected');
      void connection.send({
        command: 'request-state',
        type: 'command',
      } satisfies PresenterRemoteCommand);
    };
    connection.on('open', handleConnectionOpen);
    connection.on('data', (data) => {
      if (presenterRemoteProtocol.isState(data)) this.options.onState(data);
    });
    const handleConnectionFailure = () => {
      window.clearTimeout(timeoutId);
      this.options.onStatusChange?.('failed');
    };
    connection.on('close', handleConnectionFailure);
    connection.on('error', handleConnectionFailure);
    if (connection.open) handleConnectionOpen();
  }

  sendCommand(command: PresenterRemoteCommand) {
    if (!this.connection?.open) return false;
    void this.connection.send(command);
    return true;
  }

  close() {
    this.connection?.close();
    this.peer?.destroy();
    this.connection = undefined;
    this.peer = undefined;
  }
}
