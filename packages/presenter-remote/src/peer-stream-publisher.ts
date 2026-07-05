import { Peer, type MediaConnection, type PeerOptions } from 'peerjs';

export interface PresenterRemotePeerStreamPublisherOptions {
  peerFactory?: (() => Peer) | undefined;
  peerOptions?: PeerOptions | undefined;
  stream: MediaStream;
}

function oncePeerOpen(peer: Peer) {
  if (peer.open && peer.id) return Promise.resolve(peer.id);
  return new Promise<string>((resolve, reject) => {
    peer.on('open', resolve);
    peer.on('error', reject);
  });
}

export class PresenterRemotePeerStreamPublisher {
  private readonly calls = new Set<MediaConnection>();
  private readonly options: PresenterRemotePeerStreamPublisherOptions;
  private peer: Peer | undefined;

  constructor(options: PresenterRemotePeerStreamPublisherOptions) {
    this.options = options;
  }

  async start() {
    const peer = this.options.peerFactory?.() ??
      (this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer());
    this.peer = peer;
    peer.on('call', (call) => {
      this.calls.add(call);
      call.on('close', () => this.calls.delete(call));
      call.on('error', () => this.calls.delete(call));
      call.answer(this.options.stream);
    });
    return oncePeerOpen(peer);
  }

  stop() {
    for (const call of this.calls) call.close();
    this.calls.clear();
    this.peer?.destroy();
    this.peer = undefined;
  }
}
