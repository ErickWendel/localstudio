export type ModelDownloadContractResult = {
  imageEditingState: unknown;
  imageGenerationState: unknown;
  languageState: unknown;
  llmState: unknown;
  modelLoads: string[];
  storageWrites: string[];
  translationState: unknown;
};

export type ModelRemovalContractResult = {
  modelLoads: string[];
  removedImageEditing: unknown;
  removedImageGeneration: unknown;
  removedLlm: unknown;
  removedTranslation: unknown;
};

export type ModelFailureContractResult = {
  failedState: unknown;
};
