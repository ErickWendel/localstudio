import { Peer, type DataConnection, type PeerOptions } from 'peerjs';
import {
  presenterRemoteProtocol,
  type PresenterRemoteCommand,
  type PresenterRemotePreviewBatch,
  type PresenterRemoteState,
} from './protocol';
import { presenterRemoteDebugLog } from './debug-log';
import { presenterRemotePeerOpen } from './peer-open.ts';

export interface PresenterRemotePeerControlClientOptions {
  connectionTimeoutMs?: number | undefined;
  onPreviewBatch?: ((batch: PresenterRemotePreviewBatch) => void) | undefined;
  onState: (state: PresenterRemoteState) => void;
  onStatusChange?: ((status: 'connected' | 'connecting' | 'failed') => void) | undefined;
  peerFactory?: (() => Peer) | undefined;
  peerOptions?: PeerOptions | undefined;
  presenterPeerId: string;
}

export class PresenterRemotePeerControlClient {
  private closed = false;
  private connection: DataConnection | undefined;
  private readonly options: PresenterRemotePeerControlClientOptions;
  private peer: Peer | undefined;

  constructor(options: PresenterRemotePeerControlClientOptions) {
    this.options = options;
  }

  async start() {
    if (this.connection) return;
    this.closed = false;
    this.options.onStatusChange?.('connecting');
    const peer =
      this.options.peerFactory?.() ??
      (this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer());
    this.peer = peer;
    const timeoutMs = this.options.connectionTimeoutMs ?? 12_000;
    presenterRemoteDebugLog.info('Opening control client peer.', {
      presenterPeerId: this.options.presenterPeerId,
    });
    peer.on('error', (error) => presenterRemoteDebugLog.error('Control client peer error.', error));
    await Promise.race([
      presenterRemotePeerOpen.waitForPeer(peer),
      presenterRemotePeerOpen.rejectAfter(timeoutMs, 'PeerJS connection timed out.'),
    ]).catch((error: unknown) => {
        if (this.closed) return;
        presenterRemoteDebugLog.error('Control client peer failed to open.', error);
        this.options.onStatusChange?.('failed');
        throw error;
      });
    if (this.closed) {
      peer.destroy();
      return;
    }
    presenterRemoteDebugLog.info('Control client peer opened.');
    const connection = peer.connect(this.options.presenterPeerId, {
      label: 'localstudio-presenter-control',
      serialization: 'json',
    });
    this.connection = connection;
    let connectionOpened = false;
    const timeoutId = window.setTimeout(() => {
      if (connectionOpened || this.closed) return;
      this.options.onStatusChange?.('failed');
      connection.close();
    }, timeoutMs);
    const handleConnectionOpen = () => {
      if (connectionOpened || this.closed) return;
      connectionOpened = true;
      window.clearTimeout(timeoutId);
      presenterRemoteDebugLog.info('Control data connection opened.', {
        presenterPeerId: this.options.presenterPeerId,
      });
      this.options.onStatusChange?.('connected');
      void connection.send({
        command: 'request-state',
        type: 'command',
      } satisfies PresenterRemoteCommand);
    };
    connection.on('open', handleConnectionOpen);
    connection.on('data', (data) => {
      if (presenterRemoteProtocol.isPreviewBatch(data)) {
        presenterRemoteDebugLog.info('Control preview batch received.', {
          previewCount: data.previews.length,
          requestId: data.requestId,
        });
        this.options.onPreviewBatch?.(data);
        return;
      }
      if (!presenterRemoteProtocol.isState(data)) {
        presenterRemoteDebugLog.warn(
          'Control data message ignored because it is not remote state.',
        );
        return;
      }
      presenterRemoteDebugLog.info('Control remote state received.', {
        activePageId: data.activePageId,
        pageCount: data.pageCount,
        streamPeerId: data.stream?.peerId,
      });
      this.options.onState(data);
    });
    const handleConnectionFailure = (error?: unknown) => {
      if (this.closed) return;
      window.clearTimeout(timeoutId);
      presenterRemoteDebugLog.warn('Control data connection failed or closed.', error);
      this.options.onStatusChange?.('failed');
    };
    connection.on('close', () => handleConnectionFailure());
    connection.on('error', handleConnectionFailure);
    if (connection.open) handleConnectionOpen();
  }

  sendCommand(command: PresenterRemoteCommand) {
    if (!this.connection?.open) return false;
    try {
      void this.connection.send(command);
      presenterRemoteDebugLog.info('Control command sent.', { command: command.command });
    } catch (error) {
      presenterRemoteDebugLog.error('Failed to send control command.', error);
      return false;
    }
    return true;
  }

  close() {
    this.closed = true;
    presenterRemoteDebugLog.info('Closing control client peer.');
    this.connection?.close();
    this.peer?.destroy();
    this.connection = undefined;
    this.peer = undefined;
  }
}
