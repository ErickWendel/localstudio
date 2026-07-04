import { presenterRemoteProtocol, type PresenterRemoteCommand } from '@localstudio/presenter-remote/protocol';
import { PresenterRemoteSignalingClient } from '@localstudio/presenter-remote/signaling-client';
import { presenterRemoteWebRtc } from '@localstudio/presenter-remote/webrtc';

interface PresenterRemoteStreamPublisherOptions {
  canvas: HTMLCanvasElement;
  onCommand: (command: PresenterRemoteCommand) => void;
  sessionCode: string;
  signalingClient?: PresenterRemoteSignalingClient | undefined;
}

interface PresenterRemoteStreamConnection {
  icePollIntervalId: number;
  peerConnection: RTCPeerConnection;
}

class PresenterRemoteStreamPublisher {
  private readonly canvas: HTMLCanvasElement;
  private readonly connections = new Map<string, PresenterRemoteStreamConnection>();
  private readonly onCommand: (command: PresenterRemoteCommand) => void;
  private readonly sessionCode: string;
  private readonly signalingClient: PresenterRemoteSignalingClient;
  private offerPollIntervalId = 0;
  private stream: MediaStream | undefined;

  constructor(options: PresenterRemoteStreamPublisherOptions) {
    this.canvas = options.canvas;
    this.onCommand = options.onCommand;
    this.sessionCode = options.sessionCode;
    this.signalingClient = options.signalingClient ?? new PresenterRemoteSignalingClient({
      endpoint: '/__localstudio/presenter-remote',
    });
  }

  start() {
    if (typeof this.canvas.captureStream !== 'function') return;
    this.stream = this.canvas.captureStream(8);
    this.offerPollIntervalId = window.setInterval(() => {
      void this.answerPendingOffers();
    }, 800);
    void this.answerPendingOffers();
  }

  stop() {
    window.clearInterval(this.offerPollIntervalId);
    for (const [controllerId, connection] of this.connections) {
      window.clearInterval(connection.icePollIntervalId);
      connection.peerConnection.close();
      void this.signalingClient.closeController(this.sessionCode, controllerId).catch(() => undefined);
    }
    this.connections.clear();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }

  private async answerPendingOffers() {
    const stream = this.stream;
    if (!stream) return;
    const offers = await this.signalingClient.takeControllerOffers(this.sessionCode).catch(() => []);
    for (const offer of offers) {
      if (this.connections.has(offer.controllerId)) continue;
      await this.answerOffer(offer.controllerId, offer.offerSdp, stream);
    }
  }

  private async answerOffer(controllerId: string, offerSdp: string, stream: MediaStream) {
    const peerConnection = new RTCPeerConnection(presenterRemoteWebRtc.peerConfig);
    for (const track of stream.getVideoTracks()) peerConnection.addTrack(track, stream);
    peerConnection.ondatachannel = (event) => {
      event.channel.onmessage = (messageEvent) => {
        const parsed = parseCommand(messageEvent.data);
        if (parsed) this.onCommand(parsed);
      };
    };
    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;
      void this.signalingClient.publishIceCandidate(this.sessionCode, controllerId, {
        candidate: event.candidate.toJSON(),
        target: 'controller',
      });
    };
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState !== 'closed' && peerConnection.connectionState !== 'failed') return;
      this.closeConnection(controllerId);
    };
    await peerConnection.setRemoteDescription({ sdp: offerSdp, type: 'offer' });
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    await this.signalingClient.publishAnswer(this.sessionCode, controllerId, answer.sdp ?? '');
    const icePollIntervalId = window.setInterval(() => {
      void this.takeControllerIce(controllerId, peerConnection);
    }, 500);
    this.connections.set(controllerId, { icePollIntervalId, peerConnection });
  }

  private async takeControllerIce(controllerId: string, peerConnection: RTCPeerConnection) {
    const candidates = await this.signalingClient
      .takeIceCandidates(this.sessionCode, controllerId, 'presenter')
      .catch(() => []);
    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  private closeConnection(controllerId: string) {
    const connection = this.connections.get(controllerId);
    if (!connection) return;
    window.clearInterval(connection.icePollIntervalId);
    connection.peerConnection.close();
    this.connections.delete(controllerId);
    void this.signalingClient.closeController(this.sessionCode, controllerId).catch(() => undefined);
  }
}

function parseCommand(value: unknown) {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return presenterRemoteProtocol.isCommand(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export const presenterRemoteStreamPublisher = {
  create: (options: PresenterRemoteStreamPublisherOptions) => new PresenterRemoteStreamPublisher(options),
} as const;
