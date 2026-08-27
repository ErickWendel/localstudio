import type { Asset, ProjectDocument } from '../../domain/documents/model';
import type {
  FontImportService,
  ImageGenerationService,
  LocalFontMirrorService,
  ModelState,
  ModelSetupService,
  PromptService,
  StockMediaService,
  TranslatorService,
} from '../contracts/interfaces';
import type { AuthoringProgressReporter } from './authoringAutomationController';
import {
  AuthoringAiAssetCapability,
  type AuthoringAiModelStatus,
} from './authoringAiAssetCapability';
import {
  AuthoringCatalogCapability,
  type AuthoringCatalogResult,
} from './authoringCatalogCapability';
import {
  AuthoringMediaCapability,
  type AuthoringMediaSearchResult,
} from './authoringMediaCapability';

export interface AuthoringAssetCapabilities {
  generateImage(
    input: {
      height?: number | undefined;
      prompt: string;
      seed?: number | undefined;
      steps?: number | undefined;
      width?: number | undefined;
    },
    report: AuthoringProgressReporter,
  ): Promise<{ assetId: string; mimeType: string; name: string }>;
  getAiModelStatus(): Promise<AuthoringAiModelStatus>;
  listAuthoringCatalog(input: {
    elementType?: 'gif' | 'image' | 'shape' | 'text' | 'video' | undefined;
    kind: 'animations' | 'fonts';
  }): Promise<AuthoringCatalogResult>;
  prepareAiModels(
    input: { modelIds?: string[] | undefined },
    report: AuthoringProgressReporter,
  ): Promise<ModelState[]>;
  resolveMediaRef(mediaRef: string): Promise<Asset>;
  searchMedia(input: {
    kind: 'gif' | 'image';
    limit?: number | undefined;
    term: string;
  }): Promise<AuthoringMediaSearchResult>;
}

interface CreateAuthoringAssetCapabilitiesOptions {
  applyProject(project: ProjectDocument): void;
  fontImportService: FontImportService;
  getProject(): ProjectDocument;
  imageGenerationService: ImageGenerationService;
  localFontMirrorService: LocalFontMirrorService;
  modelSetupService: ModelSetupService;
  promptService?: Pick<PromptService, 'getProviderStates'> | undefined;
  stockMediaService: StockMediaService;
  translatorService?:
    | Pick<TranslatorService, 'getLanguageDetectionProviderStates' | 'getProviderStates'>
    | undefined;
  getBrowserCompatibility?:
    | (() => { cacheStorage: boolean; objectUrls: boolean; webGpu: boolean })
    | undefined;
}

export function createAuthoringAssetCapabilities(
  options: CreateAuthoringAssetCapabilitiesOptions,
): AuthoringAssetCapabilities {
  const catalog = new AuthoringCatalogCapability(options);
  const media = new AuthoringMediaCapability(options);
  const aiAssets = new AuthoringAiAssetCapability(options);
  return {
    generateImage: (input, report) => aiAssets.generateImage(input, report),
    getAiModelStatus: () => aiAssets.getStatus(),
    listAuthoringCatalog: (input) => catalog.list(input),
    prepareAiModels: (input, report) => aiAssets.prepareModels(input, report),
    resolveMediaRef: (mediaRef) => media.resolveMediaRef(mediaRef),
    searchMedia: (input) => media.search(input),
  };
}
