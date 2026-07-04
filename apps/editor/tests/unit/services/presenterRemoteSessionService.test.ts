import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { BrowserPresenterSessionService } from '../../../src/services/presenter/presenterSessionService';
import { InMemoryPresenterRemoteSignalingService } from '@localstudio/presenter-remote/signaling-service';
import type { PresenterRemoteSlidePreviewElement } from '@localstudio/presenter-remote/protocol';

function isImagePreviewElement(
  element: PresenterRemoteSlidePreviewElement,
): element is Extract<PresenterRemoteSlidePreviewElement, { kind: 'image' | 'media' }> {
  return element.kind === 'image';
}

function isMediaPreviewElement(
  element: PresenterRemoteSlidePreviewElement,
): element is Extract<PresenterRemoteSlidePreviewElement, { kind: 'media' }> {
  return element.kind === 'media';
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
      presenterLabel: 'MacBook Pro',
      qrUrl: 'https://localstudio.test/joystick?code=ABCD-1234',
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
      randomId: () => 'session-1',
      remoteSignalingService: signalingService,
      resolveRemoteControlOrigin: vi.fn(() => Promise.resolve('http://192.168.0.33:4176')),
    });

    service.openPresenterWindow();
    const remoteSession = await service.openRemoteControlSession({
      presenterLabel: 'MacBook Pro',
      ttlMs: 60_000,
    });

    expect(remoteSession.qrUrl).toBe('http://192.168.0.33:4176/joystick?code=ABCD-1234');
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
        slidePreview: {
          backgroundColor:
            project.pages[0]!.background.type === 'color'
              ? project.pages[0]!.background.color
              : project.pages[0]!.background.colorFallback,
          height: project.pages[0]!.height,
          width: project.pages[0]!.width,
        },
        type: 'state',
      });
    });
    const publishedState = signalingService.getPublishedState('ABCD-1234');
    expect(publishedState?.slidePreview?.elements.length).toBeGreaterThan(0);
    expect(publishedState?.pages?.[0]?.preview?.elements.length).toBeGreaterThan(0);
    expect(publishedState?.pages).toHaveLength(project.pages.length);
    expect(publishedState?.upcomingSlidePreviews).toHaveLength(
      Math.min(3, project.pages.length - 1),
    );
  });

  it('publishes portable slide preview asset URLs for remote devices', async () => {
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
      const imageElement = signalingService
        .getPublishedState('ABCD-1234')
        ?.slidePreview?.elements.find(isImagePreviewElement);
      expect(imageElement?.assetUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  it('publishes build-aware remote previews and media metadata', async () => {
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
    });
    const publishedPreview = signalingService.getPublishedState('ABCD-1234')?.slidePreview;
    expect(signalingService.getPublishedState('ABCD-1234')).toMatchObject({
      previewMode: 'stream',
      stream: { enabled: true, fps: 8, height: 340, width: 390 },
    });
    expect(publishedPreview?.elements.some((element) => element.id === hiddenElementId)).toBe(
      false,
    );
    expect(publishedPreview?.elements.find(isMediaPreviewElement)).toMatchObject({
      assetUrl: 'https://cdn.localstudio.test/demo.mp4',
      autoplay: true,
      controls: true,
      kind: 'media',
      loop: true,
      mediaType: 'video',
      muted: true,
    });
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
