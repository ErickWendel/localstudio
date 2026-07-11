import { test, withIsolatedDevServer } from '../support/journey-test';
import { shareFailureRecoveryPage } from './share-failure-recovery-page';

const getServer = withIsolatedDevServer(test);

test.describe('editor share and mirror failure recovery journey', () => {
  test('recovers from mirror connection failure and reports clipboard copy failure', async ({
    page,
  }) => {
    await shareFailureRecoveryPage.recoverMirrorAndReportClipboardFailure(
      page,
      getServer().baseURL,
    );
  });
});
