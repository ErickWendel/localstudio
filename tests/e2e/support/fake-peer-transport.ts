type Listener = (...args: unknown[]) => void;

class FakeEventTarget {
  private readonly listeners = new Map<string, Listener[]>();

  emit(eventName: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(eventName) ?? []) listener(...args);
  }

  on(eventName: string, listener: Listener): void {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
  }
}

class FakeDataConnection extends FakeEventTarget {
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

class FakeMediaConnection extends FakeEventTarget {
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

class FakePeer extends FakeEventTarget {
  destroyed = false;
  lastDataConnection: FakeDataConnection | undefined;
  lastMediaConnection: FakeMediaConnection | undefined;
  open = true;

  constructor(readonly id: string) {
    super();
  }

  call(): FakeMediaConnection {
    const call = new FakeMediaConnection();
    this.lastMediaConnection = call;
    return call;
  }

  connect(): FakeDataConnection {
    const connection = new FakeDataConnection();
    this.lastDataConnection = connection;
    return connection;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export const fakePeerTransport = {
  createDataConnection: () => new FakeDataConnection(),
  createMediaConnection: () => new FakeMediaConnection(),
  createPeer: (id: string) => new FakePeer(id),
} as const;
