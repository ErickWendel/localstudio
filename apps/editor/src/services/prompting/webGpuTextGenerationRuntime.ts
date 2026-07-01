import { TransformersRuntimeClient } from '../transformersRuntimeClient';
import { transformersOperations } from '../model-setup/transformersOperations';
import type { TextGenerationInput, TextGenerationOptions } from '../model-setup/transformersOperations';

export type { TextGenerationInput, TextGenerationOptions };

export interface TextGenerationRuntime {
  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  generate(modelId: string, prompt: TextGenerationInput, options?: TextGenerationOptions): Promise<string>;
  removeTextGenerationModel?(modelId: string): Promise<void>;
}

class TransformersTextGenerationRuntime implements TextGenerationRuntime {
  constructor(private readonly runtimeClient = new TransformersRuntimeClient()) {}

  loadTextGenerationModel(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    return this.preload(modelId, options);
  }

  releaseTextGenerationModel(modelId: string): Promise<void> {
    return this.runtimeClient.releaseTextGeneration(modelId);
  }

  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    return this.runtimeClient.preloadTextGeneration(modelId, options);
  }

  removeTextGenerationModel(modelId: string): Promise<void> {
    return this.runtimeClient.removeTextGeneration(modelId);
  }

  generate(modelId: string, prompt: TextGenerationInput, options?: TextGenerationOptions): Promise<string> {
    return this.runtimeClient.generateText(modelId, prompt, options);
  }
}

export const webGpuTextGenerationRuntime = {
  extractGeneratedText: transformersOperations.extractGeneratedText,
  TransformersTextGenerationRuntime,
};
