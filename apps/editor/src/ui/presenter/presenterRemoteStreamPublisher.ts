import { PresenterRemotePeerStreamPublisher } from '@localstudio/presenter-remote/peer-stream-publisher';
import { getRuntimePeerOptions } from '@localstudio/presenter-remote/peer-options';

interface PresenterRemoteStreamPublisherOptions {
  canvas: HTMLCanvasElement;
  onPeerId: (peerId: string | undefined) => void;
}

class PresenterRemoteStreamPublisher {
  private readonly canvas: HTMLCanvasElement;
  private readonly onPeerId: (peerId: string | undefined) => void;
  private fps = 8;
  private publisher: PresenterRemotePeerStreamPublisher | undefined;
  private stream: MediaStream | undefined;

  constructor(options: PresenterRemoteStreamPublisherOptions) {
    this.canvas = options.canvas;
    this.onPeerId = options.onPeerId;
  }

  start() {
    if (typeof this.canvas.captureStream !== 'function') return;
    this.stream = this.canvas.captureStream(this.fps);
    this.publisher = new PresenterRemotePeerStreamPublisher({
      peerOptions: getRuntimePeerOptions(),
      stream: this.stream,
    });
    void this.publisher.start().then((peerId) => {
      this.onPeerId(peerId);
    }).catch(() => {
      this.onPeerId(undefined);
    });
  }

  stop() {
    this.publisher?.stop();
    this.publisher = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.onPeerId(undefined);
  }
}

export const presenterRemoteStreamPublisher = {
  create: (options: PresenterRemoteStreamPublisherOptions) => new PresenterRemoteStreamPublisher(options),
} as const;
