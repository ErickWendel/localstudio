export type FakeRemoteCommand =
  | { command: 'go-to-page'; pageId: string; type: 'command' }
  | { command: 'next'; type: 'command' }
  | { command: 'pause-timer'; type: 'command' }
  | { command: 'request-previews'; pageIds: string[]; requestId?: string; type: 'command' }
  | { command: 'update-notes'; notes: string; pageId: string; type: 'command' };

type FakeRemotePeerControlHostOptions = {
  onCommand?: (command: FakeRemoteCommand) => void;
};

export type FakeRemotePeerControlHost = {
  readonly previewBatches: unknown[];
  readonly states: unknown[];
  closeCount: number;
  openCount: number;
  attach(options: FakeRemotePeerControlHostOptions): FakeRemotePeerControlHost;
  close(): void;
  emitCommand(command: FakeRemoteCommand): void;
  open(): Promise<{
    code: string;
    connectedControllerCount: number;
    controlPeerId: string;
    expiresAt: string;
    presenterDeviceId: string;
    presenterLabel: string;
    sessionId: string;
    transport: 'peerjs';
  }>;
  publishPreviewBatch(batch: unknown): void;
  publishState(state: unknown): void;
};

export function createFakeRemotePeerControlHost(): FakeRemotePeerControlHost {
  let options: FakeRemotePeerControlHostOptions | undefined;

  return {
    closeCount: 0,
    openCount: 0,
    previewBatches: [],
    states: [],

    attach(nextOptions: FakeRemotePeerControlHostOptions): FakeRemotePeerControlHost {
      options = nextOptions;
      return this;
    },

    close(): void {
      this.closeCount += 1;
    },

    emitCommand(command: FakeRemoteCommand): void {
      options?.onCommand?.(command);
    },

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
    },

    publishPreviewBatch(batch: unknown): void {
      this.previewBatches.push(batch);
    },

    publishState(state: unknown): void {
      this.states.push(state);
    },
  };
}
