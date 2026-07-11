export type ModelReadinessContractResult = {
  initiallyReady: number;
};

export async function evaluateModelReadinessContract(): Promise<ModelReadinessContractResult> {
  const [{ aiModelCatalog }, { imageGenerationModel }, { modelSetupService }] =
    (await Promise.all([
      import('/editor/src/services/model-setup/aiModelCatalog.ts'),
      import('/editor/src/services/image-generation/imageGenerationModel.ts'),
      import('/editor/src/services/model-setup/modelSetupService.ts'),
    ])) as [
      typeof import('../../../apps/editor/src/services/model-setup/aiModelCatalog'),
      typeof import('../../../apps/editor/src/services/image-generation/imageGenerationModel'),
      typeof import('../../../apps/editor/src/services/model-setup/modelSetupService'),
    ];

  const readyStorage = new Map<string, string>([
    [aiModelCatalog.GEMMA_LLM_READY_KEY, 'true'],
    [aiModelCatalog.TRANSLATEGEMMA_READY_KEY, 'true'],
    [aiModelCatalog.LANGUAGE_DETECTION_READY_KEY, 'true'],
    [imageGenerationModel.IMAGE_GENERATION_READY_KEY, 'true'],
  ]);
  const setup = new modelSetupService.BrowserModelSetupService(
    undefined,
    {
      getItem: (key: string) => readyStorage.get(key) ?? null,
    },
    undefined,
    undefined,
    undefined,
    undefined,
  );

  return {
    initiallyReady: (await setup.getModelStates()).filter((state) => state.status === 'ready')
      .length,
  };
}
