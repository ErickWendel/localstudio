import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);
const presenterRemoteSourceRoot = `/@fs${process.cwd()}/packages/presenter-remote/src`;

test.describe('joystick signaling contracts', () => {
  test('executes real in-memory signaling session flows in the joystick browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/joystick/', getServer().baseURL).toString());

    const result = await page.evaluate(async ({ sourceRoot }) => {
      const { InMemoryPresenterRemoteSignalingService } = (await import(
        `${sourceRoot}/signaling-service.ts`
      )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

      let now = Date.parse('2026-07-10T12:00:00.000Z');
      const service = new InMemoryPresenterRemoteSignalingService({
        now: () => now,
        randomCode: () => 'ABCD-1234',
        randomId: () => 'session-joystick',
      });

      const session = service.registerSession({
        presenterDeviceId: 'presenter-laptop',
        presenterLabel: 'Studio laptop',
        ttlMs: 60_000,
      });
      const listedBeforePairing = service.listSessions();
      const failedOffer = service.createControllerOffer({
        controllerId: 'phone-1',
        offerSdp: 'untrusted-offer',
        sessionCode: session.code,
      });
      const missingConnection = service.connectController(session.code, '');
      const connected = service.connectController(' abcd 1234 ', 'phone-1');
      const acceptedOffer = service.createControllerOffer({
        controllerId: 'phone-1',
        offerSdp: 'trusted-offer',
        sessionCode: session.code,
      });
      const pendingOffers = service.takePendingOffers(session.code);
      const answerAccepted = service.publishAnswer(session.code, 'phone-1', 'presenter-answer');
      const answer = service.getAnswer(session.code, 'phone-1');
      const controllerIceAccepted = service.publishIceCandidate(session.code, 'phone-1', {
        candidate: { candidate: 'candidate-to-controller' },
        target: 'controller',
      });
      const presenterIceAccepted = service.publishIceCandidate(session.code, 'phone-1', {
        candidate: { candidate: 'candidate-to-presenter' },
        target: 'presenter',
      });
      const controllerIce = service.takeIceCandidates(session.code, 'phone-1', 'controller');
      const presenterIce = service.takeIceCandidates(session.code, 'phone-1', 'presenter');
      const drainedPresenterIce = service.takeIceCandidates(session.code, 'phone-1', 'presenter');
      const missingIceAccepted = service.publishIceCandidate(session.code, 'missing-phone', {
        candidate: { candidate: 'missing-candidate' },
        target: 'controller',
      });
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
      const controllerClosed = service.closeController(session.code, 'phone-1');
      const afterControllerClose = service.lookupSession(session.code);
      const missingControllerClosed = service.closeController('MISSING', 'phone-1');
      const closed = service.closeSession(session.code);
      const closedAgain = service.closeSession(session.code);

      const expiring = new InMemoryPresenterRemoteSignalingService({
        now: () => now,
        randomCode: () => 'EFGH-5678',
        randomId: () => 'session-expiring',
      });
      const expiringSession = expiring.registerSession({
        presenterLabel: 'Temporary presenter',
        ttlMs: 1,
      });
      now += 2;

      return {
        acceptedOffer,
        afterControllerClose,
        anonymousCommand,
        answer,
        answerAccepted,
        closed,
        closedAgain,
        commands,
        connected,
        controllerClosed,
        controllerIce,
        controllerIceAccepted,
        drainedCommands,
        drainedPresenterIce,
        expiredLookup: expiring.lookupSession(expiringSession.code),
        failedOffer,
        listedBeforePairing,
        missingConnection,
        missingControllerClosed,
        missingIceAccepted,
        pendingOffers,
        presenterIce,
        presenterIceAccepted,
        publishedState,
        stateAccepted,
        trustedCommand,
        untrustedCommand,
      };
    }, { sourceRoot: presenterRemoteSourceRoot });

    expect(result.failedOffer).toEqual({ status: 'not-found' });
    expect(result.acceptedOffer).toEqual({ status: 'pending' });
    expect(result.listedBeforePairing).toHaveLength(1);
    expect(result.missingConnection).toBeUndefined();
    expect(result.connected).toMatchObject({ connectedControllerCount: 1 });
    expect(result.pendingOffers).toEqual([{ controllerId: 'phone-1', offerSdp: 'trusted-offer' }]);
    expect(result.answerAccepted).toBe(true);
    expect(result.answer).toBe('presenter-answer');
    expect(result.controllerIceAccepted).toBe(true);
    expect(result.presenterIceAccepted).toBe(true);
    expect(result.controllerIce).toEqual([{ candidate: 'candidate-to-controller' }]);
    expect(result.presenterIce).toEqual([{ candidate: 'candidate-to-presenter' }]);
    expect(result.drainedPresenterIce).toEqual([]);
    expect(result.missingIceAccepted).toBe(false);
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
    expect(result.controllerClosed).toBe(true);
    expect(result.afterControllerClose).toMatchObject({ connectedControllerCount: 0 });
    expect(result.missingControllerClosed).toBe(false);
    expect(result.closed).toBe(true);
    expect(result.closedAgain).toBe(false);
    expect(result.expiredLookup).toBeUndefined();
  });
});
