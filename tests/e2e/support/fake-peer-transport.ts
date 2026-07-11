import { FakePeer } from './fake-peer';
import { FakePeerDataConnection } from './fake-peer-data-connection';
import { FakePeerMediaConnection } from './fake-peer-media-connection';

export const fakePeerTransport = {
  createDataConnection: () => new FakePeerDataConnection(),
  createMediaConnection: () => new FakePeerMediaConnection(),
  createPeer: (id: string) => new FakePeer(id),
} as const;
