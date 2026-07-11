import { FakePeerDataConnection } from './fake-peer-data-connection';
import { FakePeerEventTarget } from './fake-peer-event-target';
import { FakePeerMediaConnection } from './fake-peer-media-connection';

export class FakePeer extends FakePeerEventTarget {
  destroyed = false;
  lastDataConnection: FakePeerDataConnection | undefined;
  lastMediaConnection: FakePeerMediaConnection | undefined;
  open = true;

  constructor(readonly id: string) {
    super();
  }

  call(): FakePeerMediaConnection {
    const call = new FakePeerMediaConnection();
    this.lastMediaConnection = call;
    return call;
  }

  connect(): FakePeerDataConnection {
    const connection = new FakePeerDataConnection();
    this.lastDataConnection = connection;
    return connection;
  }

  destroy(): void {
    this.destroyed = true;
  }
}
