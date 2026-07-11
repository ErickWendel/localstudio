import { aiWorkflowsMockedJourney } from './ai-workflows-mocked-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor AI workflow journey with mocked browser AI providers', () => {
  test('prepares local providers, generates image and slide content, and translates selected text', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await aiWorkflowsMockedJourney.runBrowserAiProviders(page, getServer().baseURL);
  });

  test('uses WebGPU Gemma providers for prompt generation and translation', async ({ page }) => {
    test.setTimeout(90_000);
    await aiWorkflowsMockedJourney.runWebGpuGemmaProviders(page, getServer().baseURL);
  });
});
