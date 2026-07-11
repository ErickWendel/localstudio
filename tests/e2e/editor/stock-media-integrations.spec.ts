import { stockMediaIntegrationsJourney } from './stock-media-integrations-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor stock media integrations journey', () => {
  test('configures providers, searches stock media, and inserts an Unsplash result', async ({
    page,
  }) => {
    await stockMediaIntegrationsJourney.run(page, getServer().baseURL);
  });
});
