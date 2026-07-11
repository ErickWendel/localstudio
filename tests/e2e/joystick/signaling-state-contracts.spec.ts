import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';

const getServer = withIsolatedDevServer(test);

test('executes joystick signaling state and command contracts in the browser runtime', async ({
  page,
}) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(async ({ sourceRoot }) => {
    const { InMemoryPresenterRemoteSignalingService } = (await import(
      `${sourceRoot}/signaling-service.ts`
    )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => Date.parse('2026-07-10T12:00:00.000Z'),
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-joystick',
    });
    const session = service.registerSession({
      presenterDeviceId: 'presenter-laptop',
      presenterLabel: 'Studio laptop',
      ttlMs: 60_000,
    });
    service.connectController(session.code, 'phone-1');
    const stateAccepted = service.publishState(session.code, {
      activePageId: 'slide-1',
      activePageIndex: 0,
      buildsRemaining: 0,
      canGoNext: true,
      canGoPrevious: false,
      connectedControllerCount: 0,
      currentSlideIndex: 0,
      deckName: 'Joystick contract',
      pageCount: 2,
      presenterMode: 'presenting',
      shortcuts: ['Swipe to move between slides'],
      slideCount: 2,
      slideTitle: 'Intro',
      timer: { elapsedMs: 12_000, paused: false },
      timerElapsedMs: 12_000,
      timerRunning: true,
      type: 'state',
    });
    const publishedState = service.getPublishedState(session.code);
    const trustedCommand = service.publishCommand(
      session.code,
      { command: 'next', type: 'command' },
      'phone-1',
    );
    const untrustedCommand = service.publishCommand(
      session.code,
      { command: 'previous', type: 'command' },
      'phone-2',
    );
    const anonymousCommand = service.publishCommand(session.code, {
      command: 'request-state',
      type: 'command',
    });
    const commands = service.takeCommands(session.code);
    const drainedCommands = service.takeCommands(session.code);

    return {
      anonymousCommand,
      commands,
      drainedCommands,
      publishedState,
      stateAccepted,
      trustedCommand,
      untrustedCommand,
    };
  }, { sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot });

  expect(result.stateAccepted).toBe(true);
  expect(result.publishedState).toMatchObject({ connectedControllerCount: 1 });
  expect(result.trustedCommand).toBe(true);
  expect(result.untrustedCommand).toBe(false);
  expect(result.anonymousCommand).toBe(true);
  expect(result.commands).toEqual([
    { command: 'next', type: 'command' },
    { command: 'request-state', type: 'command' },
  ]);
  expect(result.drainedCommands).toEqual([]);
});
