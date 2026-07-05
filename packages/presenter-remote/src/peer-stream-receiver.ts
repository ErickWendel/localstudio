import { Peer, type MediaConnection, type PeerOptions } from 'peerjs';
import { presenterRemoteDebugLog } from './debug-log';

export interface PresenterRemotePeerStreamReceiverOptions {
  onStatusChange: (status: 'connected' | 'connecting' | 'failed') => void;
  onStream: (stream: MediaStream | undefined) => void;
  peerFactory?: (() => Peer) | undefined;
  peerOptions?: PeerOptions | undefined;
  streamPeerId: string;
}

function oncePeerOpen(peer: Peer) {
  if (peer.open) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve());
    peer.on('error', reject);
  });
}

export class PresenterRemotePeerStreamReceiver {
  private call: MediaConnection | undefined;
  private readonly options: PresenterRemotePeerStreamReceiverOptions;
  private outgoingStream: MediaStream | undefined;
  private peer: Peer | undefined;

  constructor(options: PresenterRemotePeerStreamReceiverOptions) {
    this.options = options;
  }

  async start() {
    this.options.onStatusChange('connecting');
    const peer =
      this.options.peerFactory?.() ??
      (this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer());
    this.peer = peer;
    presenterRemoteDebugLog.info('Opening stream receiver peer.', {
      streamPeerId: this.options.streamPeerId,
    });
    peer.on('error', (error) =>
      presenterRemoteDebugLog.error('Stream receiver peer error.', error),
    );
    await oncePeerOpen(peer);
    presenterRemoteDebugLog.info('Stream receiver peer opened.');
    this.outgoingStream = createReceiverOfferStream();
    const call = peer.call(this.options.streamPeerId, this.outgoingStream);
    this.call = call;
    presenterRemoteDebugLog.info('Stream receiver media call started.', {
      streamPeerId: this.options.streamPeerId,
    });
    call.on('stream', (stream) => {
      presenterRemoteDebugLog.info('Stream receiver media stream received.', {
        trackCount: stream.getTracks().length,
      });
      this.options.onStream(stream);
      this.options.onStatusChange('connected');
    });
    call.on('close', () => {
      presenterRemoteDebugLog.warn('Stream receiver media call closed.');
      this.options.onStatusChange('failed');
    });
    call.on('error', (error) => {
      presenterRemoteDebugLog.error('Stream receiver media call error.', error);
      this.options.onStatusChange('failed');
    });
  }

  stop() {
    presenterRemoteDebugLog.info('Closing stream receiver peer.');
    this.call?.close();
    this.peer?.destroy();
    this.outgoingStream?.getTracks().forEach((track) => track.stop());
    this.call = undefined;
    this.outgoingStream = undefined;
    this.peer = undefined;
    this.options.onStream(undefined);
  }
}

function createReceiverOfferStream() {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    context?.fillRect(0, 0, 1, 1);
    if (typeof canvas.captureStream === 'function') {
      return canvas.captureStream(1);
    }
  }
  return new MediaStream();
}
