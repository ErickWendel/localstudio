import { remoteMirrorImportJourney } from './remote-mirror-import-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor remote mirror import journey', () => {
  test('lists mirrored projects and imports project files from mocked S3-compatible storage', async ({
    context,
    page,
  }) => {
    await remoteMirrorImportJourney.run(context, page, getServer().baseURL);
  });
});
