import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { BrowserPresenterSessionService } from '../../../src/services/presenter/presenterSessionService';
import { InMemoryPresenterRemoteSignalingService } from '@localstudio/presenter-remote/signaling-service';

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
