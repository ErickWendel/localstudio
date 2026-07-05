import { Peer, type MediaConnection, type PeerOptions } from 'peerjs';
import { presenterRemoteDebugLog } from './debug-log';

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
    const peer =
      this.options.peerFactory?.() ??
      (this.options.peerOptions ? new Peer(this.options.peerOptions) : new Peer());
    this.peer = peer;
    presenterRemoteDebugLog.info('Opening stream publisher peer.', {
      trackCount: this.options.stream.getTracks().length,
    });
    peer.on('error', (error) =>
      presenterRemoteDebugLog.error('Stream publisher peer error.', error),
    );
    peer.on('call', (call) => {
      presenterRemoteDebugLog.info('Stream publisher media call received.');
      this.calls.add(call);
      call.on('close', () => {
        presenterRemoteDebugLog.info('Stream publisher media call closed.');
        this.calls.delete(call);
      });
      call.on('error', (error) => {
        presenterRemoteDebugLog.error('Stream publisher media call error.', error);
        this.calls.delete(call);
      });
      call.answer(this.options.stream);
      presenterRemoteDebugLog.info('Stream publisher answered media call.');
    });
    const peerId = await oncePeerOpen(peer);
    presenterRemoteDebugLog.info('Stream publisher peer opened.', { peerId });
    return peerId;
  }

  stop() {
    presenterRemoteDebugLog.info('Closing stream publisher peer.');
    for (const call of this.calls) call.close();
    this.calls.clear();
    this.peer?.destroy();
    this.peer = undefined;
  }
}
