/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling, sample project, and animation preset contracts in the browser runtime', async ({
  page,
}) => {
  await page.goto(new URL('/editor/?newProject=1', serviceContractsSupport.getServer().baseURL).toString());

  const result = await page.evaluate(async ({ presenterRemoteSourceRoot }) => {
    const [{ animationPresetEngine }, { sampleProject }, { InMemoryPresenterRemoteSignalingService }] =
      (await Promise.all([
        import('/editor/src/ui/editor/animation/animationPresetEngine.ts'),
        import('/editor/src/domain/projects/sampleProject.ts'),
        import(`${presenterRemoteSourceRoot}/signaling-service.ts`),
      ])) as [
        typeof import('../../../apps/editor/src/ui/editor/animation/animationPresetEngine'),
        typeof import('../../../apps/editor/src/domain/projects/sampleProject'),
        typeof import('../../../packages/presenter-remote/src/signaling-service'),
      ];

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

    const blank = sampleProject.createBlankProject();
    const sample = sampleProject.createSampleProject();

    const bounds = { height: 180, width: 320, x: 10, y: 20 };
    const effects = [
      'fade',
      'fade-and-move',
      'move-in',
      'push',
      'drop',
      'fall',
      'scale',
      'switch',
      'swap',
      'flip',
      'flop',
      'cube',
      'doorway',
      'page-flip',
      'revolving-door',
      'twirl',
      'twist',
      'pivot',
      'reflection',
      'clothesline',
      'wipe',
      'reveal',
      'iris',
      'radial-wipe',
      'droplet',
      'grid',
      'mosaic',
      'blinds',
      'color-planes',
      'fade-through-color',
      'confetti',
      'swoosh',
      'keyboard-typing',
      'line-draw',
      'dissolve',
    ] as const;
    const directions = ['left', 'right', 'up', 'down'] as const;
    const animationStates = effects.map((effect, index) =>
      animationPresetEngine.getRenderState({
        bounds,
        direction: directions[index % directions.length],
        effect,
        progress: index % 3 === 0 ? 0 : index % 3 === 1 ? 0.45 : 1,
        seed: `seed-${effect}`,
      }),
    );
    const sideMaskCounts = directions.map(
      (direction) =>
        animationPresetEngine.getRenderState({
          bounds,
          direction,
          effect: 'wipe',
          progress: 0.5,
          seed: `wipe-${direction}`,
        }).masks.length,
    );

    return {
      activeAfterExpiryCount: activeAfterExpiry.length,
      animationCanonicalEffects: animationStates.map((state) => state.canonicalEffect),
      animationMaskTotal: animationStates.reduce((sum, state) => sum + state.masks.length, 0),
      animationParticleTotal: animationStates.reduce(
        (sum, state) => sum + state.particles.length,
        0,
      ),
      answer,
      answerPublished,
      anonymousCommandPublished,
      blankBackground: blank.pages[0]?.background,
      blankElementCount: Object.keys(blank.elements).length,
      blankName: blank.name,
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
      sampleAssetUrl: sample.assets['asset-hero']?.objectUrl,
      sampleElementIds: sample.pages[0]?.elementIds,
      sampleTitle: sample.elements['text-title']?.text,
      sessionAfterControllerClose,
      sessionClosed,
      sessionClosedAgain,
      sideMaskCounts,
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
    blankBackground: { color: '#050D10', type: 'color' },
    blankElementCount: 0,
    blankName: 'Untitled Project',
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
    sampleTitle: 'AI Design Revolution',
    sessionAfterControllerClose: { connectedControllerCount: 0 },
    sessionClosed: true,
    sessionClosedAgain: false,
    singleActiveCode: 'ABCD-1234',
    statePublished: true,
    trustedOffer: { status: 'pending' },
    untrustedCommandPublished: false,
    untrustedOffer: { status: 'not-found' },
  });
  expect(result.animationCanonicalEffects).toContain('fade-and-move');
  expect(result.animationMaskTotal).toBeGreaterThan(10);
  expect(result.animationParticleTotal).toBeGreaterThan(20);
  expect(result.commands.map((command) => command.type)).toEqual(['go-to-slide', 'previous-slide']);
  expect(result.controllerCandidates).toEqual([{ candidate: 'presenter-candidate' }]);
  expect(result.pendingOffers).toEqual([{ controllerId: 'controller-1', offerSdp: 'offer-sdp' }]);
  expect(result.presenterCandidates).toEqual([{ candidate: 'controller-candidate' }]);
  expect(result.publishedState).toMatchObject({
    connectedControllerCount: 1,
    notes: 'Remember the close',
    slideTitle: 'Intro',
  });
  expect(result.sampleAssetUrl).toContain('encrypted-tbn0.gstatic.com');
  expect(result.sampleElementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);
  expect(result.sideMaskCounts).toEqual([1, 1, 1, 1]);
});
