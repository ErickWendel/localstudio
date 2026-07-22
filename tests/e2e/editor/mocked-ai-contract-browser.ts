export type MockedAiContractResult = {
  backgroundProgress: number[];
  detectedSpanish: string;
  eraserMaskId: string;
  gemmaGeneratedText: string;
  gemmaRepairCalls: number;
  gemmaTaskCount: number;
  maskScore: number;
  paletteName: string;
  removedAssetId: string;
  smartGrabWidth: number;
  translatedText: string;
};

export async function evaluateMockedAiContract(): Promise<MockedAiContractResult> {
  const { inMemoryAiServices } = (await import(
    '/editor/src/services/testing/inMemoryAiServices.ts'
  )) as typeof import('../../../apps/editor/src/services/testing/inMemoryAiServices');
  const { aiModelCatalog } = (await import(
    '/editor/src/services/model-setup/aiModelCatalog.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/aiModelCatalog');
  const { browserPromptService } = (await import(
    '/editor/src/services/prompting/browserPromptService.ts'
  )) as typeof import('../../../apps/editor/src/services/prompting/browserPromptService');

  const translator = new inMemoryAiServices.MockTranslatorService();
  const paletteService = new inMemoryAiServices.MockPaletteService();
  const imageService = new inMemoryAiServices.MockImageGenerationService();
  const backgroundService = new inMemoryAiServices.MockBackgroundRemovalService();
  const smartGrabService = new inMemoryAiServices.MockSmartGrabService();
  const eraserService = new inMemoryAiServices.MockMagicEraserService();
  let gemmaGenerateCalls = 0;
  const gemmaRuntime = {
    generate: async (_modelId: string, prompt: unknown) => {
      await Promise.resolve();
      gemmaGenerateCalls += 1;
      const promptText = JSON.stringify(prompt);
      if (promptText.includes('Return only corrected JSON.')) {
        return JSON.stringify({
          language: 'en',
          page: {
            background: { color: '#050D10', type: 'color' },
            height: 1080,
            name: 'Gemma repaired slide',
            width: 1920,
          },
          tasks: [
            { color: '#050D10', type: 'set-background' },
            {
              id: 'gemma-title',
              placementHint: 'center title',
              text: 'Gemma repair path',
              type: 'add-title',
            },
          ],
        });
      }
      if (promptText.includes('JSON Schema:')) return '{"tasks":';
      return 'gemma text response';
    },
  };
  const modelSetupService = {
    downloadModel: async (id: string, options?: { onProgress?: (progress: number) => void }) => {
      await Promise.resolve();
      options?.onProgress?.(100);
      return {
        id,
        label: 'Gemma diagnostics',
        progress: 100,
        provider: 'transformers' as const,
        required: true,
        status: 'ready' as const,
      };
    },
    downloadRequiredModels: async () => {
      await Promise.resolve();
      return [];
    },
    getModelStates: async () => {
      await Promise.resolve();
      return [
        {
          id: aiModelCatalog.GEMMA_LLM_MODEL_ID,
          label: 'Gemma diagnostics',
          progress: 100,
          provider: 'transformers' as const,
          required: true,
          status: 'ready' as const,
        },
      ];
    },
  };
  const promptService = new browserPromptService.BrowserPromptService(
    modelSetupService,
    undefined,
    undefined,
    gemmaRuntime,
  );
  await promptService.setSelectedProvider(browserPromptService.GEMMA_PROMPT_PROVIDER_ID);
  const gemmaGeneratedText = await promptService.generateText('Summarize diagnostics');
  const gemmaTasks = await promptService.generateSlideTasksFromPrompt('Create a Gemma slide');

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
    gemmaGeneratedText,
    gemmaRepairCalls: gemmaGenerateCalls,
    gemmaTaskCount: gemmaTasks.tasks.length,
    maskScore: mask.score,
    paletteName: (await paletteService.generatePalette('Brand')).name,
    removedAssetId: removed.asset.id,
    smartGrabWidth: (await smartGrabService.suggestSubjectRegion()).width,
    translatedText: await translator.translate('selection', 'pt'),
  };
}
