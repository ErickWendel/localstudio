import { remoteMirrorShareJourney } from './remote-mirror-share-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor remote mirror and public share journey', () => {
  test('syncs to mocked S3-compatible storage and creates public share/embed links', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    await remoteMirrorShareJourney.run(context, page, getServer().baseURL);
  });
});
