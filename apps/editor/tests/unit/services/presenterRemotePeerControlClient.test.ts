import { describe, expect, it, vi } from 'vitest';
import { PresenterRemotePeerControlClient } from '@localstudio/presenter-remote/peer-control-client';
import type { Peer } from 'peerjs';
import { presenterRemotePeerTestKit } from './presenterRemotePeerTestKit';

const { TestClientPeer, TestClosedClientPeer } = presenterRemotePeerTestKit;

describe('PresenterRemotePeerControlClient', () => {
  it('requests state when the PeerJS data connection is already open', async () => {
    const peer = new TestClientPeer();
    const onStatusChange = vi.fn();
    const client = new PresenterRemotePeerControlClient({
      onState: vi.fn(),
      onStatusChange,
      peerFactory: () => peer as unknown as Peer,
      presenterPeerId: 'control-peer-1',
    });

    await client.start();

    expect(peer.connect).toHaveBeenCalledWith(
      'control-peer-1',
      expect.objectContaining({ label: 'localstudio-presenter-control' }),
    );
    expect(peer.connection.send).toHaveBeenCalledWith({
      command: 'request-state',
      type: 'command',
    });
    expect(onStatusChange).toHaveBeenCalledWith('connected');
  });

  it('reports a failed status when the PeerJS control connection times out', async () => {
    vi.useFakeTimers();
    const peer = new TestClosedClientPeer();
    const onStatusChange = vi.fn();
    const client = new PresenterRemotePeerControlClient({
      connectionTimeoutMs: 25,
      onState: vi.fn(),
      onStatusChange,
      peerFactory: () => peer as unknown as Peer,
      presenterPeerId: 'missing-peer',
    });

    const startPromise = client.start();
    const handledStartPromise = startPromise.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);

    expect(await handledStartPromise).toEqual(new Error('PeerJS connection timed out.'));
    expect(onStatusChange).toHaveBeenCalledWith('connecting');
    expect(onStatusChange).toHaveBeenCalledWith('failed');
    vi.useRealTimers();
  });
});
