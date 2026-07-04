export interface PresenterRemoteIceCandidateMessage {
  candidate: RTCIceCandidateInit;
  target: 'controller' | 'presenter';
}

export interface PresenterRemoteControllerOffer {
  controllerId: string;
  offerSdp: string;
}

export interface PresenterRemoteControllerAnswer {
  answerSdp: string;
}

export interface PresenterRemoteWebRtcPeerConfig {
  iceServers: RTCIceServer[];
}

export const presenterRemoteWebRtc = {
  peerConfig: {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  } satisfies PresenterRemoteWebRtcPeerConfig,
} as const;
