import { describe, expect, it, vi } from 'vitest';
import { PresenterRemotePeerControlHost } from '@localstudio/presenter-remote/peer-control-host';
import type {
  PresenterRemoteCommand,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';
import type { DataConnection, Peer } from 'peerjs';
import { presenterRemotePeerTestKit } from './presenterRemotePeerTestKit';

const { TestDataConnection, TestPeer, createRemoteState } = presenterRemotePeerTestKit;

describe('PresenterRemotePeerControlHost', () => {
  it('fails opening when PeerJS Cloud does not assign a control peer id', async () => {
    vi.useFakeTimers();
    const peer = new TestPeer();
    const host = new PresenterRemotePeerControlHost({
      connectionTimeoutMs: 25,
      peerFactory: () => peer as unknown as Peer,
      presenterLabel: 'MacBook Pro',
      ttlMs: 60_000,
    });

    const openPromise = host.open();
    const handledOpenPromise = openPromise.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);

    expect(await handledOpenPromise).toEqual(new Error('PeerJS host connection timed out.'));
    vi.useRealTimers();
  });

  it('opens a PeerJS control peer, broadcasts state, receives commands, and closes cleanly', async () => {
    const peer = new TestPeer();
    const connection = new TestDataConnection();
    const onCommand = vi.fn();
    const host = new PresenterRemotePeerControlHost({
      now: () => new Date('2026-07-04T12:00:00.000Z').getTime(),
      onCommand,
      peerFactory: () => peer as unknown as Peer,
      presenterDeviceId: 'presenter-device-1',
      presenterLabel: 'MacBook Pro',
      ttlMs: 60_000,
    });

    const openPromise = host.open();
    peer.emit('open', 'control-peer-1');
    const session = await openPromise;
    peer.emit('connection', connection as unknown as DataConnection);
    connection.emit('open', undefined);
    connection.open = false;

    expect(session).toMatchObject({
      code: 'control-peer-1',
      controlPeerId: 'control-peer-1',
      expiresAt: '2026-07-04T12:01:00.000Z',
      presenterDeviceId: 'presenter-device-1',
      presenterLabel: 'MacBook Pro',
      transport: 'peerjs',
    });

    const state = createRemoteState();
    host.publishState(state);

    expect(connection.send).toHaveBeenCalledWith(
      expect.objectContaining({
        activePageId: 'page-1',
        connectedControllerCount: 1,
        type: 'state',
      }),
    );

    host.publishPreviewBatch({
      previews: [
        {
          id: 'page-1',
          name: 'Slide 1',
          preview: {
            backgroundColor: '#000000',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
      ],
      requestId: 'preview-window-1',
      type: 'preview-batch',
    });

    expect(connection.send).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'preview-window-1',
        type: 'preview-batch',
      }),
    );

    const commands: PresenterRemoteCommand[] = [
      { command: 'next', type: 'command' },
      { command: 'previous', type: 'command' },
      { command: 'go-to-page', pageId: 'page-1', type: 'command' },
      { command: 'pause-timer', type: 'command' },
      {
        command: 'request-previews',
        pageIds: ['page-1'],
        requestId: 'preview-window-1',
        type: 'command',
      },
      { command: 'update-notes', notes: 'Updated', pageId: 'page-1', type: 'command' },
    ];
    for (const command of commands) connection.emit('data', command);

    expect(onCommand).toHaveBeenCalledTimes(commands.length);
    for (const command of commands) expect(onCommand).toHaveBeenCalledWith(command);

    host.close();

    expect(connection.close).toHaveBeenCalled();
    expect(peer.destroy).toHaveBeenCalled();
  });

  it('strips rich previews from oversized PeerJS state payloads', async () => {
    const peer = new TestPeer();
    const connection = new TestDataConnection();
    const host = new PresenterRemotePeerControlHost({
      peerFactory: () => peer as unknown as Peer,
      presenterLabel: 'MacBook Pro',
      ttlMs: 60_000,
    });

    const openPromise = host.open();
    peer.emit('open', 'control-peer-1');
    await openPromise;
    peer.emit('connection', connection as unknown as DataConnection);
    connection.emit('open', undefined);

    host.publishState({
      ...createRemoteState(),
      pages: [
        {
          id: 'page-1',
          name: 'Slide 1',
          preview: {
            backgroundColor: '#000000',
            elements: [
              {
                height: 1080,
                id: 'large-image',
                kind: 'image',
                opacity: 1,
                rotation: 0,
                width: 1920,
                x: 0,
                y: 0,
                assetUrl: `data:image/png;base64,${'a'.repeat(140_000)}`,
              },
            ],
            height: 1080,
            width: 1920,
          },
        },
      ],
      slidePreview: {
        backgroundColor: '#000000',
        elements: [
          {
            fill: '#ffffff',
            fontFamily: 'Inter',
            fontSize: 24,
            fontWeight: 700,
            height: 100,
            id: 'large-text',
            kind: 'text',
            opacity: 1,
            rotation: 0,
            text: 'a'.repeat(140_000),
            width: 800,
            x: 0,
            y: 0,
            align: 'left',
          },
        ],
        height: 1080,
        width: 1920,
      },
      stream: {
        enabled: true,
        fps: 8,
        height: 340,
        peerId: 'stream-peer-1',
        transport: 'peerjs',
        width: 390,
      },
      upcomingSlidePreviews: [
        {
          pageId: 'page-2',
          pageName: 'Next',
          preview: {
            backgroundColor: '#000000',
            elements: [],
            height: 1080,
            width: 1920,
          },
        },
      ],
    });

    const lastSentState = connection.send.mock.calls.at(-1)?.[0] as
      | PresenterRemoteState
      | undefined;
    expect(lastSentState).toMatchObject({
      activePageId: 'page-1',
      pages: [{ id: 'page-1', name: 'Slide 1' }],
      slidePreview: undefined,
      upcomingSlidePreviews: [],
    });
    expect(lastSentState?.pages?.[0]?.preview).toBeUndefined();
    expect(lastSentState?.stream?.peerId).toBe('stream-peer-1');
  });
});
