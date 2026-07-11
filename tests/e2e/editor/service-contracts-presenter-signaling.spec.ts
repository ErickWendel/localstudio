import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async ({ presenterRemoteSourceRoot }) => {
    const { InMemoryPresenterRemoteSignalingService } = (await import(
      `${presenterRemoteSourceRoot}/signaling-service.ts`
    )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

    let now = Date.parse('2026-07-09T12:00:00.000Z');
    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => now,
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });

    const session = service.registerSession({
      presenterDeviceId: 'presenter-device',
      presenterLabel: 'Main stage',
      ttlMs: 60_000,
    });
    const singleActiveCode = service.getSingleActiveSession()?.code;
    const lookupCode = service.lookupSession('abcd1234')?.code;
    const missingConnection = service.connectController(session.code, '');
    const connected = service.connectController(' abcd 1234 ', 'controller-1');
    const trustedOffer = service.createControllerOffer({
      controllerId: 'controller-1',
      offerSdp: 'offer-sdp',
      sessionCode: session.code,
    });
    const untrustedOffer = service.createControllerOffer({
      controllerId: 'controller-2',
      offerSdp: 'ignored-offer',
      sessionCode: session.code,
    });
    const missingOffer = service.createControllerOffer({
      controllerId: 'controller-1',
      offerSdp: 'missing-offer',
      sessionCode: '000000',
    });
    const pendingOffers = service.takePendingOffers(session.code);
    const missingAnswerPublished = service.publishAnswer(session.code, 'controller-2', 'answer-sdp');
    const answerPublished = service.publishAnswer(session.code, 'controller-1', 'answer-sdp');
    const answer = service.getAnswer(session.code, 'controller-1');
    const presenterIcePublished = service.publishIceCandidate(session.code, 'controller-1', {
      candidate: { candidate: 'controller-candidate' },
      target: 'presenter',
    });
    const controllerIcePublished = service.publishIceCandidate(session.code, 'controller-1', {
      candidate: { candidate: 'presenter-candidate' },
      target: 'controller',
    });
    const presenterCandidates = service.takeIceCandidates(session.code, 'controller-1', 'presenter');
    const controllerCandidates = service.takeIceCandidates(session.code, 'controller-1', 'controller');
    const drainedCandidates = service.takeIceCandidates(session.code, 'controller-1', 'presenter');
    const missingIce = service.publishIceCandidate(session.code, 'missing-controller', {
      candidate: { candidate: 'missing' },
      target: 'controller',
    });
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
    const controllerClosed = service.closeController(session.code, 'controller-1');
    const sessionAfterControllerClose = service.lookupSession(session.code);
    const missingControllerClosed = service.closeController('000000', 'controller-1');
    const sessionClosed = service.closeSession(session.code);
    const sessionClosedAgain = service.closeSession(session.code);

    const expiring = new InMemoryPresenterRemoteSignalingService({
      now: () => now,
      randomCode: () => 'EFGH-5678',
      randomId: () => 'session-expiring',
    });
    const expiringSession = expiring.registerSession({
      presenterLabel: 'Expiring',
      ttlMs: 1,
    });
    now += 2;
    const activeAfterExpiry = expiring.listActiveSessions();
    const lookupAfterExpiry = expiring.lookupSession(expiringSession.code);

    return {
      activeAfterExpiryCount: activeAfterExpiry.length,
      answer,
      answerPublished,
      anonymousCommandPublished,
      commandPublished,
      commands,
      connectedCount: connected?.connectedControllerCount,
      controllerCandidates,
      controllerClosed,
      controllerIcePublished,
      drainedCandidates,
      drainedCommands,
      lookupAfterExpiry,
      lookupCode,
      missingAnswerPublished,
      missingConnection,
      missingControllerClosed,
      missingIce,
      missingOffer,
      pendingOffers,
      presenterCandidates,
      presenterIcePublished,
      publishedState,
      sessionAfterControllerClose,
      sessionClosed,
      sessionClosedAgain,
      singleActiveCode,
      statePublished,
      trustedOffer,
      untrustedCommandPublished,
      untrustedOffer,
    };
  }, { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot });

  expect(result).toMatchObject({
    activeAfterExpiryCount: 0,
    answer: 'answer-sdp',
    answerPublished: true,
    anonymousCommandPublished: true,
    commandPublished: true,
    connectedCount: 1,
    controllerClosed: true,
    controllerIcePublished: true,
    drainedCandidates: [],
    drainedCommands: [],
    lookupAfterExpiry: undefined,
    lookupCode: 'ABCD-1234',
    missingAnswerPublished: false,
    missingConnection: undefined,
    missingControllerClosed: false,
    missingIce: false,
    missingOffer: { status: 'not-found' },
    presenterIcePublished: true,
    sessionAfterControllerClose: { connectedControllerCount: 0 },
    sessionClosed: true,
    sessionClosedAgain: false,
    singleActiveCode: 'ABCD-1234',
    statePublished: true,
    trustedOffer: { status: 'pending' },
    untrustedCommandPublished: false,
    untrustedOffer: { status: 'not-found' },
  });
  expect(result.commands.map((command) => command.type)).toEqual(['go-to-slide', 'previous-slide']);
  expect(result.controllerCandidates).toEqual([{ candidate: 'presenter-candidate' }]);
  expect(result.pendingOffers).toEqual([{ controllerId: 'controller-1', offerSdp: 'offer-sdp' }]);
  expect(result.presenterCandidates).toEqual([{ candidate: 'controller-candidate' }]);
  expect(result.publishedState).toMatchObject({
    connectedControllerCount: 1,
    notes: 'Remember the close',
    slideTitle: 'Intro',
  });
});
