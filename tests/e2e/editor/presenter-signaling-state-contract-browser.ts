export type PresenterSignalingStateContractInput = {
  presenterRemoteSourceRoot: string;
};

export type PresenterSignalingStateContractResult = {
  anonymousCommandPublished: boolean;
  commandPublished: boolean;
  commands: Array<{ type: string }>;
  drainedCommands: unknown[];
  publishedState: unknown;
  statePublished: boolean;
  untrustedCommandPublished: boolean;
};

export async function evaluatePresenterSignalingStateContract({
  presenterRemoteSourceRoot,
}: PresenterSignalingStateContractInput): Promise<PresenterSignalingStateContractResult> {
  const { InMemoryPresenterRemoteSignalingService } = (await import(
    `${presenterRemoteSourceRoot}/signaling-service.ts`
  )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

  const service = new InMemoryPresenterRemoteSignalingService({
    now: () => Date.parse('2026-07-09T12:00:00.000Z'),
    randomCode: () => 'ABCD-1234',
    randomId: () => 'session-1',
  });
  const session = service.registerSession({
    presenterDeviceId: 'presenter-device',
    presenterLabel: 'Main stage',
    ttlMs: 60_000,
  });
  service.connectController(session.code, 'controller-1');
  const statePublished = service.publishState(session.code, {
    canGoNext: true,
    canGoPrevious: false,
    connectedControllerCount: 0,
    currentSlideIndex: 0,
    notes: 'Remember the close',
    slideCount: 2,
    slideTitle: 'Intro',
    timerElapsedMs: 12_000,
    timerRunning: true,
  });
  const publishedState = service.getPublishedState(session.code);
  const commandPublished = service.publishCommand(
    session.code,
    { type: 'go-to-slide', slideIndex: 1 },
    'controller-1',
  );
  const untrustedCommandPublished = service.publishCommand(
    session.code,
    { type: 'next-slide' },
    'controller-2',
  );
  const anonymousCommandPublished = service.publishCommand(session.code, {
    type: 'previous-slide',
  });
  const commands = service.takeCommands(session.code);
  const drainedCommands = service.takeCommands(session.code);

  return {
    anonymousCommandPublished,
    commandPublished,
    commands,
    drainedCommands,
    publishedState,
    statePublished,
    untrustedCommandPublished,
  };
}
