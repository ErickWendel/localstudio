import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { BrowserPresenterSessionService } from '../../../src/services/presenter/presenterSessionService';
import { PresenterRemotePeerControlClient } from '@localstudio/presenter-remote/peer-control-client';
import { PresenterRemotePeerControlHost } from '@localstudio/presenter-remote/peer-control-host';
import { InMemoryPresenterRemoteSignalingService } from '@localstudio/presenter-remote/signaling-service';
import type {
  PresenterRemoteCommand,
  PresenterRemotePreviewBatch,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';
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

describe('BrowserPresenterSessionService remote control', () => {
  it('registers a remote control session with QR metadata', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      now: () => new Date('2026-07-04T12:00:00.000Z').getTime(),
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow: vi.fn(() => popup),
      presenterDeviceId: 'presenter-device-1',
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
    });

    service.openPresenterWindow();
    const remoteSession = await service.openRemoteControlSession({
      presenterLabel: 'MacBook Pro',
      ttlMs: 60_000,
    });

    expect(remoteSession).toEqual({
      code: 'ABCD-1234',
      connectedControllerCount: 0,
      expiresAt: '2026-07-04T12:01:00.000Z',
      presenterDeviceId: 'presenter-device-1',
      presenterLabel: 'MacBook Pro',
      qrUrl: 'https://localstudio.test/joystick/?code=ABCD-1234',
      sessionId: 'remote-session-1',
    });
  });

  it('uses the network origin for localhost QR metadata', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      now: () => new Date('2026-07-04T12:00:00.000Z').getTime(),
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: 'http://localhost:4176/editor/',
      openWindow: vi.fn(() => popup),
      presenterDeviceId: 'presenter-device-1',
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
      resolveRemoteControlOrigin: vi.fn(() => Promise.resolve('http://192.168.0.33:4176')),
    });

    service.openPresenterWindow();
    const remoteSession = await service.openRemoteControlSession({
      presenterLabel: 'MacBook Pro',
      ttlMs: 60_000,
    });

    expect(remoteSession.qrUrl).toBe('http://192.168.0.33:4176/joystick/?code=ABCD-1234');
  });

  it('publishes remote state snapshots derived from presenter payloads', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
    });
    service.openPresenterWindow();
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    const project = sampleProject.createSampleProject();

    service.publishState({
      activePageId: project.pages[0]!.id,
      animationPreview: undefined,
      project,
    });

    await vi.waitFor(() => {
      expect(signalingService.getPublishedState('ABCD-1234')).toMatchObject({
        activePageIndex: 0,
        connectedControllerCount: 0,
        notes: project.pages[0]!.speakerNotes ?? '',
        pageCount: project.pages.length,
        previewMode: 'stream',
        stream: { enabled: true, fps: 8, height: 340, width: 390 },
        type: 'state',
      });
      expect(signalingService.getPublishedState('ABCD-1234')?.slidePreview).toBeDefined();
    });
    const publishedState = signalingService.getPublishedState('ABCD-1234');
    expect(publishedState?.slidePreview?.elements.length).toBeGreaterThan(0);
    expect(publishedState?.upcomingSlidePreviews?.every((page) => page.preview)).toBe(true);
    expect(publishedState?.pages).toHaveLength(project.pages.length);
    expect(publishedState?.pages?.[0]).toEqual({
      id: project.pages[0]!.id,
      name: project.pages[0]!.name,
    });
    expect(publishedState?.upcomingSlidePreviews).toHaveLength(
      Math.min(3, project.pages.length - 1),
    );
  });

  it('publishes a lightweight PeerJS state before rich slide preview generation completes', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const peerHost = {
      close: vi.fn(),
      open: vi.fn(() =>
        Promise.resolve({
          code: 'control-peer-1',
          connectedControllerCount: 0,
          controlPeerId: 'control-peer-1',
          expiresAt: '2026-07-04T12:01:00.000Z',
          presenterDeviceId: 'presenter-device-1',
          presenterLabel: 'MacBook Pro',
          sessionId: 'peer-session-1',
          transport: 'peerjs' as const,
        }),
      ),
      publishPreviewBatch: vi.fn(),
      publishState: vi.fn(),
    };
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow: vi.fn(() => popup),
      presenterDeviceId: 'presenter-device-1',
      randomId: () => 'session-1',
      remotePeerControlHostFactory: () => peerHost,
    });
    const project = sampleProject.createSampleProject();

    service.openPresenterWindow();
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState({
      activePageId: project.pages[0]!.id,
      animationPreview: undefined,
      presenterMode: 'presenting',
      project,
      streamPeerId: 'stream-peer-1',
    });

    const firstPublishedState = peerHost.publishState.mock.calls[0]?.[0] as
      | PresenterRemoteState
      | undefined;
    expect(firstPublishedState).toMatchObject({
      activePageId: project.pages[0]!.id,
      pageCount: project.pages.length,
      previewMode: 'stream',
      type: 'state',
    });
    expect(firstPublishedState?.stream?.peerId).toBe('stream-peer-1');
    await vi.waitFor(() => {
      expect(
        peerHost.publishState.mock.calls.some((call) => {
          const state = call[0] as PresenterRemoteState | undefined;
          return Boolean(state?.slidePreview?.elements);
        }),
      ).toBe(true);
    });
  });

  it('publishes requested PeerJS slide previews in bounded batches', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const peerHost = {
      close: vi.fn(),
      open: vi.fn(() =>
        Promise.resolve({
          code: 'control-peer-1',
          connectedControllerCount: 0,
          controlPeerId: 'control-peer-1',
          expiresAt: '2026-07-04T12:01:00.000Z',
          presenterDeviceId: 'presenter-device-1',
          presenterLabel: 'MacBook Pro',
          sessionId: 'peer-session-1',
          transport: 'peerjs' as const,
        }),
      ),
      publishPreviewBatch: vi.fn(),
      publishState: vi.fn(),
    };
    let peerOptions:
      | { onCommand?: ((command: PresenterRemoteCommand) => void) | undefined }
      | undefined;
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow: vi.fn(() => popup),
      presenterDeviceId: 'presenter-device-1',
      randomId: () => 'session-1',
      remotePeerControlHostFactory: (options) => {
        peerOptions = options;
        return peerHost;
      },
    });
    const project = sampleProject.createSampleProject();

    service.openPresenterWindow();
    const unsubscribe = service.subscribeToCommands(vi.fn());
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.publishState({
      activePageId: project.pages[0]!.id,
      animationPreview: undefined,
      presenterMode: 'presenting',
      project,
      streamPeerId: 'stream-peer-1',
    });

    peerOptions?.onCommand?.({
      command: 'request-previews',
      pageIds: project.pages.slice(0, 6).map((page) => page.id),
      requestId: 'first-five',
      type: 'command',
    });

    await vi.waitFor(() => {
      expect(peerHost.publishPreviewBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'first-five',
          type: 'preview-batch',
        }),
      );
    });
    const batch = peerHost.publishPreviewBatch.mock.calls[0]?.[0] as
      | PresenterRemotePreviewBatch
      | undefined;
    expect(batch?.previews).toHaveLength(Math.min(5, project.pages.length));
    expect(batch?.previews[0]?.preview).toBeDefined();
    unsubscribe();
  });

  it('does not publish portable slide preview asset URLs in stream-mode state', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
    });
    service.openPresenterWindow();
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    const project = sampleProject.createSampleProject();
    project.assets['asset-hero'] = {
      id: 'asset-hero',
      mimeType: 'image/png',
      name: 'Hero',
      objectUrl: URL.createObjectURL(new Blob(['portable-image'], { type: 'image/png' })),
      storage: 'inline',
      type: 'image',
    };

    service.publishState({
      activePageId: project.pages[0]!.id,
      animationPreview: undefined,
      project,
    });

    await vi.waitFor(() => {
      expect(signalingService.getPublishedState('ABCD-1234')?.slidePreview).toBeDefined();
    });
    const publishedState = signalingService.getPublishedState('ABCD-1234');

    expect(publishedState?.slidePreview).toBeDefined();
    expect(JSON.stringify(publishedState)).not.toContain('data:image/png;base64');
  });

  it('keeps stream-mode remote state previews bounded for mobile polling', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
    });
    service.openPresenterWindow();
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    const project = sampleProject.createSampleProject();
    project.assets['asset-heavy'] = {
      id: 'asset-heavy',
      mimeType: 'image/png',
      name: 'Heavy slide capture',
      objectUrl: 'data:image/png;base64,'.concat('a'.repeat(500_000)),
      storage: 'inline',
      type: 'image',
    };
    project.elements['heavy-image'] = {
      assetId: 'asset-heavy',
      height: 1080,
      id: 'heavy-image',
      locked: false,
      opacity: 1,
      rotation: 0,
      type: 'image',
      visible: true,
      width: 1920,
      x: 0,
      y: 0,
    };
    project.pages[0]!.elementIds = ['heavy-image', ...project.pages[0]!.elementIds];
    project.pages.push({
      ...project.pages[0]!,
      id: 'page-next',
      name: 'Next',
      speakerNotes: '',
    });

    service.publishState({
      activePageId: project.pages[0]!.id,
      animationPreview: undefined,
      project,
    });

    await vi.waitFor(() => {
      expect(signalingService.getPublishedState('ABCD-1234')?.slidePreview).toBeDefined();
    });
    const publishedState = signalingService.getPublishedState('ABCD-1234');
    const serializedState = JSON.stringify(publishedState);

    expect(publishedState?.slidePreview).toBeDefined();
    expect(publishedState?.nextSlidePreview).toBeDefined();
    expect(publishedState?.pages?.some((page) => page.preview)).toBe(false);
    expect(publishedState?.upcomingSlidePreviews?.some((page) => page.preview)).toBe(true);
    expect(serializedState).not.toContain('data:image/png;base64,'.concat('a'.repeat(500_000)));
    expect(serializedState.length).toBeLessThan(100_000);
  });

  it('publishes build-aware stream metadata without media previews', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
    });
    service.openPresenterWindow();
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    const project = sampleProject.createSampleProject();
    const page = project.pages[0]!;
    const hiddenElementId = page.elementIds[0]!;
    project.assets['video-asset'] = {
      id: 'video-asset',
      mimeType: 'video/mp4',
      name: 'Demo video',
      objectUrl: 'https://cdn.localstudio.test/demo.mp4',
      storage: 'remote',
      type: 'video',
    };
    project.elements['video-1'] = {
      assetId: 'video-asset',
      autoplayInPreview: true,
      controls: true,
      durationSeconds: 30,
      height: 240,
      id: 'video-1',
      locked: false,
      loop: true,
      muted: true,
      opacity: 1,
      rotation: 0,
      trimStartSeconds: 0,
      type: 'video',
      visible: true,
      width: 360,
      x: 100,
      y: 120,
    };
    page.elementIds = [...page.elementIds, 'video-1'];
    page.animationBuilds = [
      {
        delayMs: 0,
        durationMs: 300,
        effect: 'fade',
        elementId: hiddenElementId,
        id: 'build-1',
        trigger: 'on-click',
      },
    ];

    service.publishState({
      activePageId: page.id,
      animationPreview: {
        activeBuild: undefined,
        activeBuildElementId: hiddenElementId,
        animationProgress: 0,
        hiddenElementIds: [hiddenElementId],
        mode: 'presenter',
        pageId: page.id,
        phase: 'waiting',
        playing: true,
        waitingForClick: true,
      },
      project,
    });

    await vi.waitFor(() => {
      expect(signalingService.getPublishedState('ABCD-1234')?.buildsRemaining).toBe(1);
      expect(signalingService.getPublishedState('ABCD-1234')?.slidePreview).toBeDefined();
    });
    expect(signalingService.getPublishedState('ABCD-1234')).toMatchObject({
      buildsRemaining: 1,
      previewMode: 'stream',
      stream: { enabled: true, fps: 8, height: 340, width: 390 },
    });
    expect(signalingService.getPublishedState('ABCD-1234')?.slidePreview).toBeDefined();
    expect(JSON.stringify(signalingService.getPublishedState('ABCD-1234'))).not.toContain(
      'https://cdn.localstudio.test/demo.mp4',
    );
  });

  it('publishes the presenter timer state received from the presenter window', async () => {
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: window.location.href,
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
    });
    service.openPresenterWindow();
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    const unsubscribe = service.subscribeToCommands(vi.fn());
    const project = sampleProject.createSampleProject();
    service.publishState({
      activePageId: project.pages[0]!.id,
      animationPreview: undefined,
      project,
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          command: 'update-timer',
          sessionId: 'session-1',
          source: 'localstudio-presenter-window',
          timer: { elapsedMs: 79_000, paused: true },
          type: 'command',
        },
      }),
    );

    await vi.waitFor(() => {
      expect(signalingService.getPublishedState('ABCD-1234')?.timer).toEqual({
        elapsedMs: 79_000,
        paused: true,
      });
    });
    unsubscribe();
  });

  it('keeps running presenter timer state current when later slide state is published', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T12:00:00.000Z'));
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: window.location.href,
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
    });
    service.openPresenterWindow();
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    const unsubscribe = service.subscribeToCommands(vi.fn());
    const project = sampleProject.createSampleProject();
    service.publishState({
      activePageId: project.pages[0]!.id,
      animationPreview: undefined,
      project,
    });

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          command: 'update-timer',
          sessionId: 'session-1',
          source: 'localstudio-presenter-window',
          timer: { elapsedMs: 30_000, paused: false },
          type: 'command',
        },
      }),
    );
    vi.setSystemTime(new Date('2026-07-04T12:00:12.000Z'));
    service.publishState({
      activePageId: project.pages[0]!.id,
      animationPreview: undefined,
      project,
    });

    await vi.waitFor(() => {
      expect(signalingService.getPublishedState('ABCD-1234')?.timer).toMatchObject({
        elapsedMs: 42_000,
        paused: false,
      });
    });
    unsubscribe();
    vi.useRealTimers();
  });

  it('routes remote commands through the existing presenter command subscription', async () => {
    vi.useFakeTimers();
    const popup = {
      location: { href: '' },
      postMessage: vi.fn(),
      closed: false,
    } as unknown as Window;
    const signalingService = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'remote-session-1',
    });
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
    });
    service.openPresenterWindow();
    await service.openRemoteControlSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    const commandHandler = vi.fn();
    const unsubscribe = service.subscribeToCommands(commandHandler);

    signalingService.publishCommand('ABCD-1234', { command: 'next', type: 'command' });
    await vi.advanceTimersByTimeAsync(300);

    expect(commandHandler).toHaveBeenCalledWith({ command: 'next' });
    unsubscribe();
    vi.useRealTimers();
  });
});

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
