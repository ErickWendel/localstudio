import { test, withIsolatedDevServer } from '../support/journey-test';
import { shareFailureRecoveryPage } from './share-failure-recovery-page';

const getServer = withIsolatedDevServer(test);

test.describe('editor share and mirror failure recovery journey', () => {
  test('recovers from mirror connection failure and creates a public link', async ({ page }) => {
    await shareFailureRecoveryPage.recoverMirrorAndCreatePublicLink(page, getServer().baseURL);
  });
});
