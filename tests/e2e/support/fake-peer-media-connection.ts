import { FakePeerEventTarget } from './fake-peer-event-target';

export class FakePeerMediaConnection extends FakePeerEventTarget {
  answeredStream: MediaStream | undefined;
  wasClosed = false;

  answer(stream: MediaStream): void {
    this.answeredStream = stream;
  }

  close(): void {
    this.wasClosed = true;
    this.emit('close');
  }
}
