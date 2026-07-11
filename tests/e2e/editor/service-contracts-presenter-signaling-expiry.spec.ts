import { expect, test } from '../support/journey-test';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter signaling expiry contracts in the browser runtime', async ({ page }) => {
  await presenterSignalingContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);

  const result = await page.evaluate(async ({ presenterRemoteSourceRoot }) => {
    const { InMemoryPresenterRemoteSignalingService } = (await import(
      `${presenterRemoteSourceRoot}/signaling-service.ts`
    )) as typeof import('../../../packages/presenter-remote/src/signaling-service');

    let now = Date.parse('2026-07-09T12:00:00.000Z');
    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => now,
      randomCode: () => 'EFGH-5678',
      randomId: () => 'session-expiring',
    });
    const session = service.registerSession({
      presenterLabel: 'Expiring',
      ttlMs: 1,
    });
    now += 2;

    return {
      activeAfterExpiryCount: service.listActiveSessions().length,
      lookupAfterExpiry: service.lookupSession(session.code),
    };
  }, { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot });

  expect(result).toMatchObject({
    activeAfterExpiryCount: 0,
    lookupAfterExpiry: undefined,
  });
});
