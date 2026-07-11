import {
  loadPresenterPeerControlModules,
  type PresenterPeerControlContractHarnessInput,
} from './presenter-peer-control-modules';

export type PresenterPeerStreamPublisherLifecycleInput = PresenterPeerControlContractHarnessInput & {
  peerId: string;
};

export type PresenterPeerStreamPublisherLifecycleResult = {
  answeredStreamCall: boolean;
  callClosed: boolean;
  callErrored: boolean;
  destroyedPeer: boolean;
  streamPeerId: string;
};

export async function runPresenterPeerStreamPublisherLifecycle({
  peerId,
  ...input
}: PresenterPeerStreamPublisherLifecycleInput): Promise<PresenterPeerStreamPublisherLifecycleResult> {
  const { PresenterRemotePeerStreamPublisher, fakePeerTransport } =
    await loadPresenterPeerControlModules(input);
  const streamPeer = fakePeerTransport.createPeer(peerId);
  const stream = new MediaStream();
  const publisher = new PresenterRemotePeerStreamPublisher({
    peerFactory: () => streamPeer as never,
    stream,
  });

  const streamPeerId = await publisher.start();
  const mediaCall = fakePeerTransport.createMediaConnection();
  streamPeer.emit('call', mediaCall);
  const answeredStreamCall = mediaCall.answeredStream === stream;
  mediaCall.emit('error', new Error('call failed'));
  const callErrored = mediaCall.wasClosed === false;
  const closingCall = fakePeerTransport.createMediaConnection();
  streamPeer.emit('call', closingCall);
  closingCall.close();
  publisher.stop();

  return {
    answeredStreamCall,
    callClosed: closingCall.wasClosed,
    callErrored,
    destroyedPeer: streamPeer.destroyed,
    streamPeerId,
  };
}
