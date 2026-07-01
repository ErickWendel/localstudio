import { TransformersRuntimeClient } from '../model-setup/transformersRuntimeClient';
import { transformersOperations } from '../model-setup/transformersOperations';
import type { LanguageDetectionResult } from '../model-setup/transformersOperations';

export interface LanguageDetectionRuntime {
  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  detectLanguage(modelId: string, text: string): Promise<LanguageDetectionResult>;
}

class TransformersLanguageDetectionRuntime implements LanguageDetectionRuntime {
  constructor(private readonly runtimeClient = new TransformersRuntimeClient()) {}

  loadLanguageDetectionModel(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    return this.preload(modelId, options);
  }

  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void> {
    return this.runtimeClient.preloadLanguageDetection(modelId, options);
  }

  detectLanguage(modelId: string, text: string) {
    return this.runtimeClient.detectLanguage(modelId, text);
  }
}

export const webGpuLanguageDetectionRuntime = {
  extractDetectedLanguage: transformersOperations.extractDetectedLanguage,
  TransformersLanguageDetectionRuntime,
};
