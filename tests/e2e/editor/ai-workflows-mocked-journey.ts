import { type Page } from '@playwright/test';

import { aiBrowserProvidersFlow } from './ai-browser-providers-flow';
import { aiWebGpuGemmaProvidersFlow } from './ai-webgpu-gemma-providers-flow';

export const aiWorkflowsMockedJourney = {
  async runBrowserAiProviders(page: Page, baseURL: string): Promise<void> {
    await aiBrowserProvidersFlow.run(page, baseURL);
  },

  async runWebGpuGemmaProviders(page: Page, baseURL: string): Promise<void> {
    await aiWebGpuGemmaProvidersFlow.run(page, baseURL);
  },
};
