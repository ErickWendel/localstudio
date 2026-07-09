import { TransformersRuntimeClient } from '../model-setup/transformersRuntimeClient';
import { transformersResultParsing } from '../model-setup/transformersResultParsing';
import type { ModelDownloadProgressDetails } from '../contracts/interfaces';
import type { LanguageDetectionResult } from '../model-setup/transformersRuntimeTypes';

export interface LanguageDetectionRuntime {
  preload(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void>;
  detectLanguage(modelId: string, text: string): Promise<LanguageDetectionResult>;
}

class TransformersLanguageDetectionRuntime implements LanguageDetectionRuntime {
  constructor(private readonly runtimeClient = new TransformersRuntimeClient()) {}

  loadLanguageDetectionModel(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
    return this.preload(modelId, options);
  }

  preload(
    modelId: string,
    options?: { onProgress?: (progress: number, details?: ModelDownloadProgressDetails) => void },
  ): Promise<void> {
    return this.runtimeClient.preloadLanguageDetection(modelId, options);
  }

  detectLanguage(modelId: string, text: string) {
    return this.runtimeClient.detectLanguage(modelId, text);
  }
}

export const webGpuLanguageDetectionRuntime = {
  extractDetectedLanguage: transformersResultParsing.extractDetectedLanguage,
  TransformersLanguageDetectionRuntime,
};
