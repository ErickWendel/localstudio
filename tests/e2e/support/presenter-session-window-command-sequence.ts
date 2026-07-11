import { dispatchPresenterWindowCommand } from './presenter-window-command-dispatch';

export type PresenterSessionWindowCommandSequenceInput = {
  origin: string;
  sessionId: string;
  targetWindow: Window;
};

export function dispatchPresenterSessionWindowCommandSequence({
  origin,
  sessionId,
  targetWindow,
}: PresenterSessionWindowCommandSequenceInput): void {
  dispatchPresenterWindowCommand(targetWindow, origin, {
    command: 'update-timer',
    sessionId,
    timer: { elapsedMs: 5_000, paused: false, updatedAtEpochMs: 1_786_000_005_000 },
  });
  dispatchPresenterWindowCommand(targetWindow, origin, {
    command: 'update-stream-peer',
    peerId: 'stream-peer-2',
    sessionId,
  });
  dispatchPresenterWindowCommand(targetWindow, origin, {
    command: 'go-to-page',
    pageId: 'slide-3',
    sessionId,
  });
  dispatchPresenterWindowCommand(targetWindow, origin, {
    command: 'next',
    sessionId,
  });
  dispatchPresenterWindowCommand(targetWindow, origin, {
    command: 'next',
    sessionId: 'wrong-session',
  });
}
