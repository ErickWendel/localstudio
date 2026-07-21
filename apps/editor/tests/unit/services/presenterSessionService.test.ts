import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { BrowserPresenterSessionService } from '../../../src/services/presenter/presenterSessionService';

describe('BrowserPresenterSessionService', () => {
  it('opens a same-origin presenter route with a generated session id', () => {
    const popup = { location: { href: '' }, postMessage: vi.fn(), closed: false } as unknown as Window;
    const openWindow = vi.fn(() => popup);
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/?project=Demo',
      openWindow,
      randomId: () => 'session-1',
    });

    const session = service.openPresenterWindow();

    expect(session).toEqual({ status: 'opened', sessionId: 'session-1' });
    expect(openWindow).toHaveBeenCalledWith(
      '',
      'localstudio-presenter-session-1',
      'popup,width=1280,height=760',
    );
    expect(popup.location.href).toBe(
      'https://localstudio.test/editor/?project=Demo&presenter=1&presenterSession=session-1',
    );
  });

  it('returns a blocked result when the popup cannot open', () => {
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => null),
      randomId: () => 'session-2',
    });

    expect(service.openPresenterWindow()).toEqual({ status: 'blocked', sessionId: 'session-2' });
  });

  it('treats same-window popup fallback as blocked', () => {
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => window),
      randomId: () => 'session-2b',
      targetWindow: window,
    });

    expect(service.openPresenterWindow()).toEqual({ status: 'blocked', sessionId: 'session-2b' });
  });

  it('publishes presenter state only to the matching popup', () => {
    const popupPostMessage = vi.fn();
    const popup = { location: { href: '' }, postMessage: popupPostMessage, closed: false } as unknown as Window;
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-3',
    });
    service.openPresenterWindow();

    service.publishState({
      activePageId: 'page-1',
      animationPreview: undefined,
      project: sampleProject.createSampleProject(),
    });

    expect(popupPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-3',
        source: 'localstudio-presenter-main',
        type: 'state',
      }),
      'https://localstudio.test',
    );
  });

  it('closes the active presenter popup and clears the session', () => {
    const popupClose = vi.fn();
    const popupPostMessage = vi.fn();
    const popup = {
      close: popupClose,
      closed: false,
      location: { href: '' },
      postMessage: popupPostMessage,
    } as unknown as Window;
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-3b',
    });
    service.openPresenterWindow();

    service.closePresenterWindow();
    service.publishState({
      activePageId: 'page-1',
      animationPreview: undefined,
      project: sampleProject.createSampleProject(),
    });

    expect(popupClose).toHaveBeenCalledTimes(1);
    expect(popupPostMessage).not.toHaveBeenCalled();
  });

  it('does not close an already closed presenter popup', () => {
    const popupClose = vi.fn();
    const popup = {
      close: popupClose,
      closed: true,
      location: { href: '' },
      postMessage: vi.fn(),
    } as unknown as Window;
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-3c',
    });
    service.openPresenterWindow();

    service.closePresenterWindow();

    expect(popupClose).not.toHaveBeenCalled();
  });

  it('accepts commands only from the same origin and active session', () => {
    const popup = { location: { href: '' }, postMessage: vi.fn(), closed: false } as unknown as Window;
    const commandHandler = vi.fn();
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-4',
      targetWindow: window,
    });
    service.openPresenterWindow();
    const unsubscribe = service.subscribeToCommands(commandHandler);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://localstudio.test',
        data: {
          command: 'next',
          sessionId: 'wrong-session',
          source: 'localstudio-presenter-window',
          type: 'command',
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.test',
        data: {
          command: 'next',
          sessionId: 'session-4',
          source: 'localstudio-presenter-window',
          type: 'command',
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://localstudio.test',
        data: {
          command: 'next',
          sessionId: 'session-4',
          source: 'localstudio-presenter-window',
          type: 'command',
        },
      }),
    );

    expect(commandHandler).toHaveBeenCalledTimes(1);
    expect(commandHandler).toHaveBeenCalledWith({ command: 'next' });
    unsubscribe();
  });

  it('accepts request-state commands from the active presenter session', () => {
    const popup = { location: { href: '' }, postMessage: vi.fn(), closed: false } as unknown as Window;
    const commandHandler = vi.fn();
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-5',
      targetWindow: window,
    });
    service.openPresenterWindow();
    const unsubscribe = service.subscribeToCommands(commandHandler);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://localstudio.test',
        data: {
          command: 'request-state',
          sessionId: 'session-5',
          source: 'localstudio-presenter-window',
          type: 'command',
        },
      }),
    );

    expect(commandHandler).toHaveBeenCalledWith({ command: 'request-state' });
    unsubscribe();
  });

  it('forwards go-to-page commands from the active presenter session', () => {
    const popup = { location: { href: '' }, postMessage: vi.fn(), closed: false } as unknown as Window;
    const commandHandler = vi.fn();
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-6',
      targetWindow: window,
    });
    service.openPresenterWindow();
    const unsubscribe = service.subscribeToCommands(commandHandler);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://localstudio.test',
        data: {
          command: 'go-to-page',
          pageId: 'page-2',
          sessionId: 'session-6',
          source: 'localstudio-presenter-window',
          type: 'command',
        },
      }),
    );

    expect(commandHandler).toHaveBeenCalledWith({ command: 'go-to-page', pageId: 'page-2' });
    unsubscribe();
  });

  it('forwards saved presenter recordings from the active presenter session', () => {
    const popup = { location: { href: '' }, postMessage: vi.fn(), closed: false } as unknown as Window;
    const commandHandler = vi.fn();
    const service = new BrowserPresenterSessionService({
      href: 'https://localstudio.test/editor/',
      openWindow: vi.fn(() => popup),
      randomId: () => 'session-7',
      targetWindow: window,
    });
    const project = sampleProject.createSampleProject();
    const audioBlob = new Blob(['partial talk audio'], { type: 'audio/webm;codecs=opus' });
    const recording = {
      id: 'recording-1',
      name: 'Presenter recording',
      createdAt: '2026-07-20T20:00:00.000Z',
      updatedAt: '2026-07-20T20:00:00.000Z',
      durationMs: 1800,
      modelPresetId: 'web-speech-api',
      audio: {
        mimeType: 'audio/webm;codecs=opus',
        storage: 'inline' as const,
      },
      segments: [
        {
          id: 'segment-1',
          text: '[Slide 1] Partial slide recording.',
          startMs: 0,
          endMs: 1800,
          final: true,
          pageId: project.pages[0]!.id,
          pageIndex: 0,
          pageName: project.pages[0]!.name,
        },
      ],
    };
    service.openPresenterWindow();
    const unsubscribe = service.subscribeToCommands(commandHandler);

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://localstudio.test',
        data: {
          audioBlob,
          command: 'save-recording',
          recording,
          sessionId: 'session-7',
          source: 'localstudio-presenter-window',
          type: 'command',
        },
      }),
    );

    expect(commandHandler).toHaveBeenCalledWith({
      audioBlob,
      command: 'save-recording',
      recording,
    });
    unsubscribe();
  });
});
