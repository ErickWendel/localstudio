type FakeRemoteCommand =
  | { command: 'go-to-page'; pageId: string; type: 'command' }
  | { command: 'next'; type: 'command' }
  | { command: 'pause-timer'; type: 'command' }
  | { command: 'request-previews'; pageIds: string[]; requestId?: string; type: 'command' }
  | { command: 'update-notes'; notes: string; pageId: string; type: 'command' };

type FakeRemotePeerControlHostOptions = {
  onCommand?: (command: FakeRemoteCommand) => void;
};

class FakePresenterPopup {
  readonly messages: unknown[] = [];
  closed = false;
  location = { href: '' };

  close(): void {
    this.closed = true;
  }

  postMessage(message: unknown): void {
    this.messages.push(message);
  }
}

class FakeRemotePeerControlHost {
  closeCount = 0;
  openCount = 0;
  private options: FakeRemotePeerControlHostOptions | undefined;
  readonly previewBatches: unknown[] = [];
  readonly states: unknown[] = [];

  attach(options: FakeRemotePeerControlHostOptions): this {
    this.options = options;
    return this;
  }

  close(): void {
    this.closeCount += 1;
  }

  emitCommand(command: FakeRemoteCommand): void {
    this.options?.onCommand?.(command);
  }

  open(): Promise<{
    code: string;
    connectedControllerCount: number;
    controlPeerId: string;
    expiresAt: string;
    presenterDeviceId: string;
    presenterLabel: string;
    sessionId: string;
    transport: 'peerjs';
  }> {
    this.openCount += 1;
    return Promise.resolve({
      code: 'peer-control-1',
      connectedControllerCount: 0,
      controlPeerId: 'peer-control-1',
      expiresAt: '2026-07-10T12:01:00.000Z',
      presenterDeviceId: 'presenter-device-1',
      presenterLabel: 'Studio laptop',
      sessionId: 'peer-session-1',
      transport: 'peerjs',
    });
  }

  publishPreviewBatch(batch: unknown): void {
    this.previewBatches.push(batch);
  }

  publishState(state: unknown): void {
    this.states.push(state);
  }
}

function countPresenterMessages(messages: unknown[], type: 'command' | 'state') {
  return messages.filter(
    (message) =>
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === type,
  ).length;
}

export const presenterSessionServiceHarness = {
  commandNames(commands: unknown[]) {
    return commands.map((command) =>
      typeof command === 'object' && command !== null && 'command' in command
        ? String(command.command)
        : 'unknown',
    );
  },

  countPresenterMessages,

  createPeerControlHost: () => new FakeRemotePeerControlHost(),

  createPopup: () => new FakePresenterPopup(),

  dispatchPresenterWindowCommand(
    targetWindow: Window,
    origin: string,
    data: Record<string, unknown>,
  ) {
    targetWindow.dispatchEvent(
      new MessageEvent('message', {
        data: {
          ...data,
          source: 'localstudio-presenter-window',
          type: 'command',
        },
        origin,
      }),
    );
  },

  flushAsyncWork: () => new Promise((resolve) => window.setTimeout(resolve, 0)),
} as const;
