import { vi } from 'vitest';
import type { PresenterRemoteState } from '@localstudio/presenter-remote/protocol';
import type { DataConnection, Peer } from 'peerjs';

type PeerEventMap = {
  connection: DataConnection;
  error: Error;
  open: string;
};

type DataConnectionEventMap = {
  close: undefined;
  data: unknown;
  error: Error;
  open: undefined;
};

class TestPeer {
  readonly destroy = vi.fn();
  readonly id = '';
  readonly open: boolean = false;
  private readonly listeners = new Map<keyof PeerEventMap, Array<(payload: never) => void>>();

  emit<EventName extends keyof PeerEventMap>(
    eventName: EventName,
    payload: PeerEventMap[EventName],
  ) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(payload as never);
    }
  }

  on<EventName extends keyof PeerEventMap>(
    eventName: EventName,
    listener: (payload: PeerEventMap[EventName]) => void,
  ) {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
    return this as unknown as Peer;
  }
}

class TestClientPeer extends TestPeer {
  readonly connection = new TestDataConnection();
  readonly connect = vi.fn(() => this.connection as unknown as DataConnection);
  override readonly open = true;
}

class TestClosedClientPeer extends TestPeer {
  readonly connection = new TestDataConnection();
  readonly connect = vi.fn(() => this.connection as unknown as DataConnection);
}

class TestDataConnection {
  readonly close = vi.fn(() => {
    this.open = false;
    this.emit('close', undefined);
  });
  readonly send = vi.fn((payload?: unknown) => {
    void payload;
    return Promise.resolve();
  });
  open = true;
  private readonly listeners = new Map<
    keyof DataConnectionEventMap,
    Array<(payload: never) => void>
  >();

  emit<EventName extends keyof DataConnectionEventMap>(
    eventName: EventName,
    payload: DataConnectionEventMap[EventName],
  ) {
    for (const listener of this.listeners.get(eventName) ?? []) {
      listener(payload as never);
    }
  }

  on<EventName extends keyof DataConnectionEventMap>(
    eventName: EventName,
    listener: (payload: DataConnectionEventMap[EventName]) => void,
  ) {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);
    return this as unknown as DataConnection;
  }
}

function createRemoteState(): PresenterRemoteState {
  return {
    activePageId: 'page-1',
    activePageIndex: 0,
    buildsRemaining: 0,
    connectedControllerCount: 0,
    deckName: 'Launch Deck',
    notes: '',
    pageCount: 1,
    presenterMode: 'presenting',
    shortcuts: ['previous', 'next'],
    timer: { elapsedMs: 0, paused: false },
    type: 'state',
  };
}

export const presenterRemotePeerTestKit = {
  TestClientPeer,
  TestClosedClientPeer,
  TestDataConnection,
  TestPeer,
  createRemoteState,
};
