import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes mocked AI service contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async () => {
    const { inMemoryAiServices } = (await import(
      '/editor/src/services/testing/inMemoryAiServices.ts'
    )) as typeof import('../../../apps/editor/src/services/testing/inMemoryAiServices');

    const translator = new inMemoryAiServices.MockTranslatorService();
    const paletteService = new inMemoryAiServices.MockPaletteService();
    const imageService = new inMemoryAiServices.MockImageGenerationService();
    const backgroundService = new inMemoryAiServices.MockBackgroundRemovalService();
    const smartGrabService = new inMemoryAiServices.MockSmartGrabService();
    const eraserService = new inMemoryAiServices.MockMagicEraserService();

    const image = await imageService.generateImage('Neon launch card', {
      height: 512,
      seed: 7,
      steps: 4,
      width: 512,
    });
    const backgroundProgress: number[] = [];
    await backgroundService.prepareBackgroundRemoval(image, {
      onProgress: (value) => backgroundProgress.push(value),
    });
    const mask = await backgroundService.previewBackgroundMask(image, {
      subjectPoint: { x: 0.2, y: 0.4 },
    });
    const removed = await backgroundService.removeBackground(image);

    return {
      backgroundProgress,
      detectedSpanish: await translator.detectLanguage('olá ¿qué tal?'),
      eraserMaskId: (await eraserService.createMask('asset-1')).maskAssetId,
      maskScore: mask.score,
      paletteName: (await paletteService.generatePalette('Brand')).name,
      removedAssetId: removed.asset.id,
      smartGrabWidth: (await smartGrabService.suggestSubjectRegion()).width,
      translatedText: await translator.translate('selection', 'pt'),
    };
  });

  expect(result).toMatchObject({
    detectedSpanish: 'es',
    eraserMaskId: 'asset-1-mask',
    maskScore: 0.9,
    paletteName: 'Brand',
    removedAssetId: 'asset-generated-neon-launch-card-transparent',
    smartGrabWidth: 0.8,
    translatedText: '[pt] selection',
  });
  expect(result.backgroundProgress.at(-1)).toBe(100);
});
