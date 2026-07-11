import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';

const getServer = withIsolatedDevServer(test);

test('executes joystick signaling expiry contracts in the browser runtime', async ({ page }) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(async ({ sourceRoot }) => {
    const { InMemoryPresenterRemoteSignalingService } = (await import(
      `${sourceRoot}/signaling-service.ts`
    )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

    let now = Date.parse('2026-07-10T12:00:00.000Z');
    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => now,
      randomCode: () => 'EFGH-5678',
      randomId: () => 'session-expiring',
    });
    const session = service.registerSession({
      presenterLabel: 'Temporary presenter',
      ttlMs: 1,
    });
    now += 2;

    return {
      expiredLookup: service.lookupSession(session.code),
    };
  }, { sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot });

  expect(result.expiredLookup).toBeUndefined();
});
