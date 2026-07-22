import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluateMockedAiContract } from './mocked-ai-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes mocked AI service contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateMockedAiContract);

  expect(result).toMatchObject({
    detectedSpanish: 'es',
    eraserMaskId: 'asset-1-mask',
    gemmaGeneratedText: 'gemma text response',
    gemmaRepairCalls: 3,
    gemmaTaskCount: 2,
    maskScore: 0.9,
    paletteName: 'Brand',
    removedAssetId: 'asset-generated-neon-launch-card-transparent',
    smartGrabWidth: 0.8,
    translatedText: '[pt] selection',
  });
  expect(result.backgroundProgress.at(-1)).toBe(100);
});
