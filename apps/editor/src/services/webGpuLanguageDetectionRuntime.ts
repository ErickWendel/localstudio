import { TransformersRuntimeClient } from './transformersRuntimeClient';
import { extractDetectedLanguage, type LanguageDetectionResult } from './transformersOperations';

export { extractDetectedLanguage };

export interface LanguageDetectionRuntime {
  preload(modelId: string, options?: { onProgress?: (progress: number) => void }): Promise<void>;
  detectLanguage(modelId: string, text: string): Promise<LanguageDetectionResult>;
}

export class TransformersLanguageDetectionRuntime implements LanguageDetectionRuntime {
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
