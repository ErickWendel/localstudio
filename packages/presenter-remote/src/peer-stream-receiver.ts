import { Peer, type MediaConnection, type PeerOptions } from 'peerjs';

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
  private peer: Peer | undefined;

  constructor(options: PresenterRemotePeerStreamReceiverOptions) {
    this.options = options;
  }

  async start() {
    this.options.onStatusChange('connecting');
    const peer = this.options.peerFactory?.() ??
      (this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer());
    this.peer = peer;
    await oncePeerOpen(peer);
    const call = peer.call(this.options.streamPeerId, new MediaStream());
    this.call = call;
    call.on('stream', (stream) => {
      this.options.onStream(stream);
      this.options.onStatusChange('connected');
    });
    call.on('close', () => this.options.onStatusChange('failed'));
    call.on('error', () => this.options.onStatusChange('failed'));
  }

  stop() {
    this.call?.close();
    this.peer?.destroy();
    this.call = undefined;
    this.peer = undefined;
    this.options.onStream(undefined);
  }
}
