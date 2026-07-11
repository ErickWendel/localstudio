import {
  loadPresenterPeerControlModules,
  type PresenterPeerControlContractHarnessInput,
} from './presenter-peer-control-modules';

export type PresenterPeerStreamReceiverLifecycleInput = PresenterPeerControlContractHarnessInput & {
  failureMode: 'close' | 'error-and-close';
  peerId: string;
  streamPeerId: string;
};

export type PresenterPeerStreamReceiverLifecycleResult = {
  clearedStream: boolean;
  destroyedPeer: boolean;
  gotStream: boolean;
  statuses: string[];
};

export async function runPresenterPeerStreamReceiverLifecycle({
  failureMode,
  peerId,
  streamPeerId,
  ...input
}: PresenterPeerStreamReceiverLifecycleInput): Promise<PresenterPeerStreamReceiverLifecycleResult> {
  const { PresenterRemotePeerStreamReceiver, fakePeerTransport } =
    await loadPresenterPeerControlModules(input);
  const receiverPeer = fakePeerTransport.createPeer(peerId);
  const statuses: string[] = [];
  const streams: Array<MediaStream | undefined> = [];
  const receiver = new PresenterRemotePeerStreamReceiver({
    onStatusChange: (status) => statuses.push(status),
    onStream: (stream) => streams.push(stream),
    peerFactory: () => receiverPeer as never,
    streamPeerId,
  });

  await receiver.start();
  const receivedStream = new MediaStream();
  receiverPeer.lastMediaConnection?.emit('stream', receivedStream);
  if (failureMode === 'error-and-close') {
    receiverPeer.lastMediaConnection?.emit('error', new Error('receiver call failed'));
  }
  receiverPeer.lastMediaConnection?.emit('close');
  receiver.stop();

  return {
    clearedStream: streams.at(-1) === undefined,
    destroyedPeer: receiverPeer.destroyed,
    gotStream: streams.includes(receivedStream),
    statuses,
  };
}
