import type { AiProviderState } from '../contracts/interfaces';
import { imageGenerationModel } from '../image-generation/imageGenerationModel';

function getSelectedPromptModelProperties(promptProviderStates: AiProviderState[]) {
  const selectedProvider = promptProviderStates.find((provider) => provider.selected);
  return {
    model_name: selectedProvider?.modelId ?? selectedProvider?.label ?? selectedProvider?.id,
  };
}

function getImageGenerationModelProperties() {
  return {
    model_name: imageGenerationModel.IMAGE_GENERATION_TRANSFORMERS_MODEL_ID,
  };
}

export const analyticsModelProperties = {
  getImageGenerationModelProperties,
  getSelectedPromptModelProperties,
};
