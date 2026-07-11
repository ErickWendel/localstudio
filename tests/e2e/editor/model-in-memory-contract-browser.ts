export type ModelInMemoryContractResult = {
  readyCount: number;
  removed: unknown;
};

export async function evaluateModelInMemoryContract(): Promise<ModelInMemoryContractResult> {
  const { modelSetupService } = (await import(
    '/editor/src/services/model-setup/modelSetupService.ts'
  )) as typeof import('../../../apps/editor/src/services/model-setup/modelSetupService');

  const setup = new modelSetupService.InMemoryModelSetupService();
  const required = await setup.downloadRequiredModels();
  const removed = await setup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID);

  return {
    readyCount: required.filter((state) => state.status === 'ready').length,
    removed,
  };
}
