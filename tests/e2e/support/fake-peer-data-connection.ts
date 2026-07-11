import { FakePeerEventTarget } from './fake-peer-event-target';

export class FakePeerDataConnection extends FakePeerEventTarget {
  open = true;
  sentMessages: unknown[] = [];
  throwOnSend = false;
  wasClosed = false;

  close(): void {
    this.wasClosed = true;
    this.emit('close');
  }

  send(message: unknown): void {
    if (this.throwOnSend) throw new Error('send failed');
    this.sentMessages.push(message);
  }
}
