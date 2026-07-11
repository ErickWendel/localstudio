import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { BrowserPresenterSessionService } from '../../../src/services/presenter/presenterSessionService';
import { InMemoryPresenterRemoteSignalingService } from '@localstudio/presenter-remote/signaling-service';
import type {
  PresenterRemoteCommand,
  PresenterRemotePreviewBatch,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';

describe('BrowserPresenterSessionService remote previews', () => {
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

  it('publishes generated video thumbnails for remote slide previews', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const fakeCanvas = {
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      height: 0,
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,video-thumbnail'),
      width: 0,
    };
    const fakeVideo = {
      crossOrigin: '',
      currentTime: 0,
      duration: 12,
      load: vi.fn(),
      muted: false,
      onerror: undefined as (() => void) | undefined,
      onloadeddata: undefined as (() => void) | undefined,
      onloadedmetadata: undefined as (() => void) | undefined,
      onseeked: undefined as (() => void) | undefined,
      playsInline: false,
      preload: '',
      readyState: 2,
      removeAttribute: vi.fn(),
      src: '',
      videoHeight: 720,
      videoWidth: 1280,
    };
    const createElement = vi.spyOn(document, 'createElement');
    createElement.mockImplementation((tagName: string) => {
      if (tagName === 'video') return fakeVideo as unknown as HTMLVideoElement;
      if (tagName === 'canvas') return fakeCanvas as unknown as HTMLCanvasElement;
      return originalCreateElement(tagName);
    });
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
    project.assets['video-thumbnail-asset'] = {
      id: 'video-thumbnail-asset',
      mimeType: 'video/mp4',
      name: 'Thumbnail demo',
      objectUrl: 'blob:thumbnail-demo',
      storage: 'remote',
      type: 'video',
    };
    project.elements['video-thumbnail-element'] = {
      assetId: 'video-thumbnail-asset',
      autoplayInPreview: false,
      controls: false,
      durationSeconds: 12,
      height: 360,
      id: 'video-thumbnail-element',
      locked: false,
      loop: false,
      muted: true,
      opacity: 1,
      posterFrameSeconds: 4,
      rotation: 0,
      trimStartSeconds: 1,
      type: 'video',
      visible: true,
      width: 640,
      x: 80,
      y: 90,
    };
    page.elementIds = ['video-thumbnail-element'];

    service.publishState({
      activePageId: page.id,
      animationPreview: undefined,
      project,
    });

    await vi.waitFor(() => expect(fakeVideo.onloadedmetadata).toBeTypeOf('function'));
    fakeVideo.onloadedmetadata?.();
    fakeVideo.onseeked?.();
    await vi.waitFor(() => {
      expect(signalingService.getPublishedState('ABCD-1234')?.slidePreview).toBeDefined();
    });
    const publishedState = signalingService.getPublishedState('ABCD-1234');
    const videoElement = publishedState?.slidePreview?.elements.find(
      (element) => element.id === 'video-thumbnail-element',
    );

    expect(fakeVideo.currentTime).toBe(4);
    expect(videoElement).toMatchObject({
      assetUrl: 'data:image/jpeg;base64,video-thumbnail',
      kind: 'media',
      mediaType: 'video',
    });
    expect(JSON.stringify(publishedState)).not.toContain('blob:thumbnail-demo');
    createElement.mockRestore();
  });

});
