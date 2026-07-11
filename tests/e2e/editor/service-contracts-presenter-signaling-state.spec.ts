import { expect, test } from '../support/journey-test';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling state and command contracts in the browser runtime', async ({
  page,
}) => {
  await presenterSignalingContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async ({ presenterRemoteSourceRoot }) => {
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
    const anonymousCommandPublished = service.publishCommand(session.code, { type: 'previous-slide' });
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
  }, { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot });

  expect(result).toMatchObject({
    anonymousCommandPublished: true,
    commandPublished: true,
    drainedCommands: [],
    statePublished: true,
    untrustedCommandPublished: false,
  });
  expect(result.commands.map((command) => command.type)).toEqual(['go-to-slide', 'previous-slide']);
  expect(result.publishedState).toMatchObject({
    connectedControllerCount: 1,
    notes: 'Remember the close',
    slideTitle: 'Intro',
  });
});
