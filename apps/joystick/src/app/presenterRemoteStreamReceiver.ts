import type {
  PresenterRemoteCommand,
  PresenterRemoteStreamPreference,
} from '@localstudio/presenter-remote/protocol';
import { presenterRemoteWebRtc } from '@localstudio/presenter-remote/webrtc';

export interface PresenterRemoteStreamSignaling {
  closeController?: ((code: string, controllerId: string) => Promise<void> | void) | undefined;
  createControllerOffer?: ((code: string, controllerId: string, offerSdp: string) => Promise<void> | void) | undefined;
  getAnswer?: ((code: string, controllerId: string) => Promise<string | undefined> | string | undefined) | undefined;
  publishIceCandidate?: ((
    code: string,
    controllerId: string,
    message: { candidate: RTCIceCandidateInit; target: 'controller' | 'presenter' },
  ) => Promise<void> | void) | undefined;
  takeIceCandidates?: ((
    code: string,
    controllerId: string,
    target: 'controller' | 'presenter',
  ) => Promise<RTCIceCandidateInit[]> | RTCIceCandidateInit[]) | undefined;
}

interface PresenterRemoteStreamReceiverOptions {
  controllerId: string;
  onStatusChange: (status: 'connected' | 'connecting' | 'failed') => void;
  onStream: (stream: MediaStream | undefined) => void;
  sessionCode: string;
  signaling: PresenterRemoteStreamSignaling;
}

class PresenterRemoteStreamReceiver {
  private answerPollIntervalId = 0;
  private dataChannel: RTCDataChannel | undefined;
  private icePollIntervalId = 0;
  private readonly onStatusChange: PresenterRemoteStreamReceiverOptions['onStatusChange'];
  private readonly onStream: PresenterRemoteStreamReceiverOptions['onStream'];
  private readonly options: PresenterRemoteStreamReceiverOptions;
  private pendingPreference: PresenterRemoteStreamPreference | undefined;
  private peerConnection: RTCPeerConnection | undefined;
  private started = false;

  constructor(options: PresenterRemoteStreamReceiverOptions) {
    this.options = options;
    this.onStatusChange = options.onStatusChange;
    this.onStream = options.onStream;
  }

  async start() {
    if (this.started) return;
    this.started = true;
    if (!canUseWebRtc(this.options.signaling)) {
      this.onStatusChange('failed');
      return;
    }
    this.onStatusChange('connecting');
    const peerConnection = new RTCPeerConnection(presenterRemoteWebRtc.peerConfig);
    this.peerConnection = peerConnection;
    this.dataChannel = peerConnection.createDataChannel('presenter-control', { ordered: true });
    this.dataChannel.onopen = () => {
      if (this.pendingPreference) this.sendStreamPreference(this.pendingPreference);
    };
    peerConnection.addTransceiver('video', { direction: 'recvonly' });
    peerConnection.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.onStream(stream);
      this.onStatusChange('connected');
    };
    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !this.options.signaling.publishIceCandidate) return;
      void this.options.signaling.publishIceCandidate(this.options.sessionCode, this.options.controllerId, {
        candidate: event.candidate.toJSON(),
        target: 'presenter',
      });
    };
    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') this.onStatusChange('connected');
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
        this.onStatusChange('failed');
      }
    };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await this.options.signaling.createControllerOffer?.(
      this.options.sessionCode,
      this.options.controllerId,
      offer.sdp ?? '',
    );
    this.answerPollIntervalId = window.setInterval(() => {
      void this.tryApplyAnswer();
    }, 500);
    this.icePollIntervalId = window.setInterval(() => {
      void this.takePresenterIce();
    }, 500);
    await this.tryApplyAnswer();
  }

  sendCommand(command: PresenterRemoteCommand) {
    if (this.dataChannel?.readyState !== 'open') return false;
    this.dataChannel.send(JSON.stringify(command));
    return true;
  }

  sendStreamPreference(preference: PresenterRemoteStreamPreference) {
    this.pendingPreference = preference;
    if (this.dataChannel?.readyState !== 'open') return false;
    this.dataChannel.send(JSON.stringify(preference));
    return true;
  }

  stop() {
    window.clearInterval(this.answerPollIntervalId);
    window.clearInterval(this.icePollIntervalId);
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = undefined;
    this.peerConnection = undefined;
    this.onStream(undefined);
    void this.options.signaling.closeController?.(this.options.sessionCode, this.options.controllerId);
  }

  private async tryApplyAnswer() {
    const peerConnection = this.peerConnection;
    if (!peerConnection || peerConnection.remoteDescription) return;
    const answerSdp = await this.options.signaling.getAnswer?.(this.options.sessionCode, this.options.controllerId);
    if (!answerSdp) return;
    await peerConnection.setRemoteDescription({ sdp: answerSdp, type: 'answer' });
    window.clearInterval(this.answerPollIntervalId);
  }

  private async takePresenterIce() {
    const peerConnection = this.peerConnection;
    if (!peerConnection || !this.options.signaling.takeIceCandidates) return;
    const candidates = await this.options.signaling.takeIceCandidates(
      this.options.sessionCode,
      this.options.controllerId,
      'controller',
    );
    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(candidate).catch(() => undefined);
    }
  }
}

function canUseWebRtc(signaling: PresenterRemoteStreamSignaling) {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof MediaStream !== 'undefined' &&
    Boolean(signaling.createControllerOffer && signaling.getAnswer && signaling.publishIceCandidate)
  );
}

export const presenterRemoteStreamReceiver = {
  create: (options: PresenterRemoteStreamReceiverOptions) => new PresenterRemoteStreamReceiver(options),
} as const;
