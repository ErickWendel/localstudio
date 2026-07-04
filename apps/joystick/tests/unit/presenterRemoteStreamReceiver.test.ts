import { afterEach, describe, expect, it, vi } from 'vitest';
import { presenterRemoteStreamReceiver } from '../../src/app/presenterRemoteStreamReceiver';

class FakeMediaStream {
  private readonly tracks: Array<{ stop: () => void }>;

  constructor(tracks: Array<{ stop: () => void }>) {
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }
}

class FakePeerConnection {
  static latest: FakePeerConnection | undefined;

  connectionState = 'new';
  remoteDescription: RTCSessionDescriptionInit | undefined;
  onconnectionstatechange: (() => void) | undefined;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | undefined;
  ontrack: ((event: RTCTrackEvent) => void) | undefined;

  constructor() {
    FakePeerConnection.latest = this;
  }

  addIceCandidate = vi.fn(() => Promise.resolve());
  addTransceiver = vi.fn();
  close = vi.fn(() => {
    this.connectionState = 'closed';
  });
  createDataChannel = vi.fn(() => ({
    close: vi.fn(),
    readyState: 'open',
    send: vi.fn(),
  }));
  createOffer = vi.fn(() => Promise.resolve({ sdp: 'offer-sdp', type: 'offer' }));
  setLocalDescription = vi.fn(() => Promise.resolve());
  setRemoteDescription = vi.fn((description: RTCSessionDescriptionInit) => {
    this.remoteDescription = description;
    return Promise.resolve();
  });
}

describe('presenterRemoteStreamReceiver', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops old media tracks when streams are replaced or the receiver stops', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    vi.stubGlobal('MediaStream', FakeMediaStream);
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    const onStream = vi.fn();
    const receiver = presenterRemoteStreamReceiver.create({
      controllerId: 'controller-1',
      onStatusChange: vi.fn(),
      onStream,
      sessionCode: 'ABCD-1234',
      signaling: {
        closeController: vi.fn(),
        createControllerOffer: vi.fn(),
        getAnswer: vi.fn(),
        publishIceCandidate: vi.fn(),
      },
    });

    await receiver.start();
    const firstStream = new FakeMediaStream([{ stop: firstStop }]) as unknown as MediaStream;
    const secondStream = new FakeMediaStream([{ stop: secondStop }]) as unknown as MediaStream;
    FakePeerConnection.latest?.ontrack?.({ streams: [firstStream] } as unknown as RTCTrackEvent);
    FakePeerConnection.latest?.ontrack?.({ streams: [secondStream] } as unknown as RTCTrackEvent);

    expect(firstStop).toHaveBeenCalledTimes(1);
    expect(secondStop).not.toHaveBeenCalled();

    receiver.stop();

    expect(secondStop).toHaveBeenCalledTimes(1);
    expect(onStream).toHaveBeenLastCalledWith(undefined);
  });
});
