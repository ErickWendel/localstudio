import type { Page } from '@playwright/test';

import { mockAiBrowserApiInitScript } from './mock-ai-browser-api-init-script';
import { mockAiFixtures } from './mock-ai-fixtures';
import { mockAiWorkerInitScript } from './mock-ai-worker-init-script';

interface MockAiProviderOptions {
  bonsaiGenerateFailures?: number;
}

export async function installMockAiProviders(page: Page, options: MockAiProviderOptions = {}) {
  await page.addInitScript(mockAiBrowserApiInitScript, {
    slideElements: mockAiFixtures.slideElements,
    slideTasks: mockAiFixtures.slideTasks,
  });
  await page.addInitScript(mockAiWorkerInitScript, {
    mockOptions: options,
    pngBytes: mockAiFixtures.generatedImagePng,
    slideElements: mockAiFixtures.slideElements,
    slideTasks: mockAiFixtures.slideTasks,
  });
}
