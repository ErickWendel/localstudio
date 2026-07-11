import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';

const getServer = withIsolatedDevServer(test);

test('executes joystick signaling session lifecycle contracts in the browser runtime', async ({
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
    const listedBeforePairing = service.listSessions();
    const missingConnection = service.connectController(session.code, '');
    const connected = service.connectController(' abcd 1234 ', 'phone-1');
    const controllerClosed = service.closeController(session.code, 'phone-1');
    const afterControllerClose = service.lookupSession(session.code);
    const missingControllerClosed = service.closeController('MISSING', 'phone-1');
    const closed = service.closeSession(session.code);
    const closedAgain = service.closeSession(session.code);

    return {
      afterControllerClose,
      closed,
      closedAgain,
      connected,
      controllerClosed,
      listedBeforePairing,
      missingConnection,
      missingControllerClosed,
    };
  }, { sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot });

  expect(result.listedBeforePairing).toHaveLength(1);
  expect(result.missingConnection).toBeUndefined();
  expect(result.connected).toMatchObject({ connectedControllerCount: 1 });
  expect(result.controllerClosed).toBe(true);
  expect(result.afterControllerClose).toMatchObject({ connectedControllerCount: 0 });
  expect(result.missingControllerClosed).toBe(false);
  expect(result.closed).toBe(true);
  expect(result.closedAgain).toBe(false);
});
