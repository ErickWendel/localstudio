import {
  createFakeRemotePeerControlSession,
  type FakeRemotePeerControlSession,
} from './fake-remote-peer-control-session';

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
  open(): Promise<FakeRemotePeerControlSession>;
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

    open(): Promise<FakeRemotePeerControlSession> {
      this.openCount += 1;
      return Promise.resolve(createFakeRemotePeerControlSession());
    },

    publishPreviewBatch(batch: unknown): void {
      this.previewBatches.push(batch);
    },

    publishState(state: unknown): void {
      this.states.push(state);
    },
  };
}
