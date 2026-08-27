import type { ProjectDocument } from '../../domain/documents/model';
import type {
  AiProviderState,
  ImageGenerationService,
  ModelDownloadProgressDetails,
  ModelSetupService,
  ModelState,
  PromptService,
  TranslatorService,
} from '../contracts/interfaces';
import type { AuthoringProgressReporter } from './authoringAutomationController';

export interface AuthoringAiModelStatus {
  browser: {
    cacheStorage: boolean;
    objectUrls: boolean;
    webGpu: boolean;
  };
  models: Array<{
    compatible: boolean;
    description?: string | undefined;
    downloadedBytes: number;
    error?: string | undefined;
    label: string;
    modelId: string;
    progress: number;
    provider: ModelState['provider'];
    required: boolean;
    sizeKnown: boolean;
    status: ModelState['status'];
    totalBytes: number | null;
  }>;
  providers: AiProviderState[];
  selectedProviders: AiProviderState[];
}

interface AuthoringAiAssetCapabilityOptions {
  applyProject(project: ProjectDocument): void;
  getProject(): ProjectDocument;
  imageGenerationService: ImageGenerationService;
  modelSetupService: ModelSetupService;
  promptService?: Pick<PromptService, 'getProviderStates'> | undefined;
  translatorService?:
    | Pick<TranslatorService, 'getLanguageDetectionProviderStates' | 'getProviderStates'>
    | undefined;
  getBrowserCompatibility?: (() => AuthoringAiModelStatus['browser']) | undefined;
}

function defaultBrowserCompatibility(): AuthoringAiModelStatus['browser'] {
  return {
    cacheStorage: typeof caches !== 'undefined',
    objectUrls: typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function',
    webGpu:
      typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu),
  };
}

function boundedProvider(provider: AiProviderState): AiProviderState {
  return {
    ...provider,
    description: provider.description.slice(0, 500),
    ...(provider.disabledReason ? { disabledReason: provider.disabledReason.slice(0, 500) } : {}),
  };
}

export class AuthoringAiAssetCapability {
  constructor(private readonly options: AuthoringAiAssetCapabilityOptions) {}

  async getStatus(): Promise<AuthoringAiModelStatus> {
    const browser = (this.options.getBrowserCompatibility ?? defaultBrowserCompatibility)();
    const [models, promptProviders, translationProviders, languageDetectionProviders] =
      await Promise.all([
        this.options.modelSetupService.getModelStates(),
        this.options.promptService?.getProviderStates?.() ?? Promise.resolve([]),
        this.options.translatorService?.getProviderStates?.() ?? Promise.resolve([]),
        this.options.translatorService?.getLanguageDetectionProviderStates?.() ??
          Promise.resolve([]),
      ]);
    const providers = [...promptProviders, ...translationProviders, ...languageDetectionProviders]
      .map(boundedProvider)
      .slice(0, 20);
    return {
      browser,
      models: models.slice(0, 20).map((model) => ({
        compatible: model.provider === 'chrome' || browser.webGpu,
        ...(model.description ? { description: model.description.slice(0, 500) } : {}),
        downloadedBytes:
          model.loadedBytes ?? (model.status === 'ready' ? (model.totalBytes ?? 0) : 0),
        ...(model.error ? { error: model.error.slice(0, 500) } : {}),
        label: model.label,
        modelId: model.id,
        progress: model.progress,
        provider: model.provider,
        required: model.required,
        sizeKnown: model.totalBytes !== undefined,
        status: model.status,
        totalBytes: model.totalBytes ?? null,
      })),
      providers,
      selectedProviders: providers.filter((provider) => provider.selected),
    };
  }

  async prepareModels(
    input: { modelIds?: string[] | undefined },
    report: AuthoringProgressReporter,
  ): Promise<ModelState[]> {
    const states = await this.options.modelSetupService.getModelStates();
    const knownIds = new Set(states.map((state) => state.id));
    const requestedIds = input.modelIds
      ? [...new Set(input.modelIds.map((id) => id.trim()).filter(Boolean))]
      : states.filter((state) => state.required).map((state) => state.id);
    const unknownIds = requestedIds.filter((id) => !knownIds.has(id));
    if (unknownIds.length) throw new Error(`Unknown model IDs: ${unknownIds.join(', ')}.`);
    if (!requestedIds.length) {
      report({ stage: 'models-ready', progress: 100, current: 0, total: 0 });
      return [];
    }

    const byteProgress = new Map<string, ModelDownloadProgressDetails>();
    const completed: ModelState[] = [];
    for (let index = 0; index < requestedIds.length; index += 1) {
      const modelId = requestedIds[index]!;
      const model = await this.options.modelSetupService.downloadModel(modelId, {
        onProgress: (modelProgress, details) => {
          if (details) byteProgress.set(modelId, details);
          const knownBytes = [...byteProgress.values()];
          const loadedBytes = knownBytes.reduce(
            (total, progress) => total + (progress.loadedBytes ?? 0),
            0,
          );
          const totalBytes = knownBytes.reduce(
            (total, progress) => total + (progress.totalBytes ?? 0),
            0,
          );
          report({
            stage: 'downloading-model',
            detail: modelId,
            current: index + 1,
            total: requestedIds.length,
            progress:
              ((index + Math.max(0, Math.min(100, modelProgress)) / 100) / requestedIds.length) *
              100,
            ...(loadedBytes > 0 ? { loadedBytes } : {}),
            ...(totalBytes > 0 ? { totalBytes } : {}),
          });
        },
      });
      if (model.status === 'failed') {
        throw new Error(model.error || `Model ${model.id} could not be prepared.`);
      }
      completed.push(model);
      report({
        stage: 'preparing-ai-models',
        detail: model.id,
        current: completed.length,
        total: requestedIds.length,
        progress: (completed.length / requestedIds.length) * 100,
      });
    }
    return completed;
  }

  async generateImage(
    input: {
      height?: number | undefined;
      prompt: string;
      seed?: number | undefined;
      steps?: number | undefined;
      width?: number | undefined;
    },
    report: AuthoringProgressReporter,
  ): Promise<{ assetId: string; mimeType: string; name: string }> {
    const asset = await this.options.imageGenerationService.generateImage(input.prompt, {
      ...(input.height !== undefined ? { height: input.height } : {}),
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
      ...(input.steps !== undefined ? { steps: input.steps } : {}),
      ...(input.width !== undefined ? { width: input.width } : {}),
      onProgress: (progress) =>
        report({
          stage: 'generating-image',
          detail: progress.label.slice(0, 200),
          progress: progress.progress,
        }),
    });
    if (asset.type !== 'image') throw new Error('Image generation returned an invalid asset type.');
    const project = this.options.getProject();
    if (project.assets[asset.id])
      throw new Error(`Generated asset ID already exists: ${asset.id}.`);
    this.options.applyProject({
      ...project,
      assets: { ...project.assets, [asset.id]: asset },
      updatedAt: new Date().toISOString(),
    });
    return { assetId: asset.id, mimeType: asset.mimeType, name: asset.name };
  }
}
