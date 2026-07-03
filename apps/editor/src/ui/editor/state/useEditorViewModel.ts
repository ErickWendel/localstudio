import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppServices } from '../../../app/composition';
import { basicCommands } from '../../../domain/commands/elements/basicCommands';
import type {
  AlignMode,
  ElementAnimationPatch,
  ElementFramePatch,
  ImageCropPatch,
  ElementStylePatch,
  MediaPlaybackPatch,
  ZOrderMode,
} from '../../../domain/commands/elements/basicCommands';
import type { GeneratedSlideElement } from '../../../domain/generated-slides/generatedSlide';
import { fitImageWithinPage } from '../../../domain/images/imageSizing';
import type {
  DesignElement,
  ImageElement,
  Page,
  PageBackground,
  ProjectDocument,
  SelectionState,
  ShapeElement,
  ShapeKind,
  SlideTransition,
} from '../../../domain/documents/model';
import { sampleProject } from '../../../domain/projects/sampleProject';
import type { EditorAutomationDelegate } from '../../../services/automation/editorAutomationController';
import type {
  AiProviderState,
  MirrorProjectSummary,
  MirrorState,
  ModelDownloadProgressDetails,
  ModelState,
  PromptApiAvailability,
  StockMediaConfig,
  StockMediaItem,
  StockMediaProviderState,
  VersionHistoryEntry,
} from '../../../services/contracts/interfaces';
import type { PptxImportInput } from '../../../services/importing/pptx/pptxImportService';
import { pptxImportLogger } from '../../../services/importing/pptx/pptxImportLogger';
import { minioMirrorService } from '../../../services/mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../../../services/mirror/minioMirrorService';
import { aiModelCatalog } from '../../../services/model-setup/aiModelCatalog';
import { imageGenerationModel } from '../../../services/image-generation/imageGenerationModel';
import { modelSetupService } from '../../../services/model-setup/modelSetupService';
import { createPrefixedId } from '../../../services/ids/idUtils';
import { slideTaskPrompt } from '../../../services/prompting/slideTaskPrompt';
import { imagePromptOptions } from '../media/imagePromptOptions';
import type { CreateImagePromptOptions } from '../media/imagePromptOptions';
import { TRANSLATION_LANGUAGE_OPTIONS } from '../translation/translationLanguages';
import { translationLanguageUtils } from '../translation/translationLanguageUtils';
import { editorPreferences } from '../persistence/editorPreferences';
import { useAnimationPreviewController } from '../animation/useAnimationPreviewController';

export type RightPanelTab =
  | 'layout'
  | 'text'
  | 'elements'
  | 'design'
  | 'ai-tools'
  | 'assets'
  | 'animations';
export type TextPreset = 'title' | 'subtitle' | 'body';

interface EditorHistory {
  past: ProjectDocument[];
  future: ProjectDocument[];
}

interface BackgroundPreviewState {
  elementId: string;
  maskUrl?: string;
  pending: boolean;
  score?: number;
}

interface BackgroundPreparationState {
  elementId: string;
  progress: number;
  status: 'preparing' | 'ready' | 'failed';
}

interface BackgroundSelectionPoint {
  x: number;
  y: number;
  positive: boolean;
}

interface TranslationPreparationState extends ModelDownloadProgressDetails {
  progress: number;
  sourceLanguage?: string;
  status: 'idle' | 'downloading' | 'ready' | 'failed';
}

interface PromptPreparationState extends ModelDownloadProgressDetails {
  availability: PromptApiAvailability;
  progress: number;
  status: 'idle' | 'downloading' | 'ready' | 'failed';
}

export interface PresentationImportProgressState {
  detail: string;
  progress: number;
  stage: 'reading' | 'inspecting' | 'extracting-objects' | 'extracting-media' | 'mapping-animations' | 'opening';
  title: string;
}

interface ElementClipboardState {
  assets: ProjectDocument['assets'];
  elements: DesignElement[];
}

interface StockMediaSearchState {
  gifs: boolean;
  images: boolean;
}

export interface StockMediaErrorState {
  gifs?: string | undefined;
  images?: string | undefined;
}

function getDownloadProgressPatch(
  progress: number,
  details: ModelDownloadProgressDetails | undefined,
): ModelDownloadProgressDetails & { progress: number } {
  return {
    estimatedRemainingMs: details?.estimatedRemainingMs,
    loadedBytes: details?.loadedBytes,
    progress,
    totalBytes: details?.totalBytes,
  };
}

export type RemoteImportStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'importing'
  | 'deleting'
  | 'failed';

type WindowWithPowerPointPicker = Window &
  typeof globalThis & {
    showOpenFilePicker?: (options?: {
      excludeAcceptAllOption?: boolean;
      multiple?: boolean;
      types?: Array<{
        description: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle[]>;
  };

const IMAGE_EDITING_MODEL_REQUIRED_MESSAGE = 'You must download the image editing tools first.';
const PROMPT_API_REQUIRED_MESSAGE = 'LLM model must be prepared before using prompt-to-slides.';
const IMAGE_GENERATION_MODEL_REQUIRED_MESSAGE =
  'Download image generation models before creating images.';
const IMAGE_PROMPT_MODE_REQUIRED_MESSAGE = 'Use Create image from the + menu to generate images.';
const IMAGE_GENERATION_DIMENSION_MULTIPLE = 16;
const BACKGROUND_PREVIEW_DEBOUNCE_MS = 120;
const PASTED_ELEMENT_OFFSET = 32;
const STOCK_MEDIA_RECENT_LIMIT = 12;

function normalizeImageGenerationDimension(value: number) {
  return Math.max(
    IMAGE_GENERATION_DIMENSION_MULTIPLE,
    Math.round(value / IMAGE_GENERATION_DIMENSION_MULTIPLE) * IMAGE_GENERATION_DIMENSION_MULTIPLE,
  );
}

function writeProjectNameToUrl(projectName: string) {
  if (typeof window === 'undefined') return;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('project', projectName);
  window.history.replaceState(
    window.history.state,
    '',
    `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
  );
}

function normalizeProjectDocument(project: ProjectDocument): ProjectDocument {
  const shouldRestoreHeroImage =
    Boolean(project.assets['asset-hero']) && !project.elements['image-hero'];
  const pageId = project.pages[0]?.id;
  const elements: ProjectDocument['elements'] = {};

  for (const [id, element] of Object.entries(project.elements)) {
    const isLegacyScaledHero =
      id === 'image-hero' &&
      element.type === 'image' &&
      element.assetId === 'asset-hero' &&
      element.width === 1200 &&
      element.height === 650;
    elements[id] = {
      ...element,
      ...(isLegacyScaledHero ? sampleProject.SAMPLE_HERO_IMAGE_SIZE : {}),
      visible: element.visible ?? true,
    };
  }

  if (shouldRestoreHeroImage) {
    elements['image-hero'] = {
      id: 'image-hero',
      type: 'image',
      assetId: 'asset-hero',
      x: sampleProject.SAMPLE_HERO_IMAGE_SIZE.x,
      y: sampleProject.SAMPLE_HERO_IMAGE_SIZE.y,
      width: sampleProject.SAMPLE_HERO_IMAGE_SIZE.width,
      height: sampleProject.SAMPLE_HERO_IMAGE_SIZE.height,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
    };
  }

  return {
    ...project,
    assets: {
      ...project.assets,
      ...(project.assets['asset-hero']
        ? {
            'asset-hero': {
              ...project.assets['asset-hero'],
              objectUrl:
                project.assets['asset-hero'].objectUrl ?? sampleProject.SAMPLE_HERO_IMAGE_URL,
            },
          }
        : {}),
    },
    elements,
    pages: (shouldRestoreHeroImage
      ? project.pages.map((page) =>
          page.id === pageId
            ? {
                ...page,
                elementIds: (() => {
                  const nextElementIds = page.elementIds.filter((id) => id !== 'image-hero');
                  nextElementIds.splice(0, 0, 'image-hero');
                  return nextElementIds;
                })(),
              }
            : page,
        )
      : project.pages
    ).map((page) => ({
      ...page,
      animationBuilds: page.animationBuilds ?? [],
      visible: page.visible ?? true,
    })),
  };
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Image file could not be read as a data URL.'));
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('Image file could not be read.'));
    });
    reader.readAsDataURL(file);
  });
}

function readImageSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    });
    image.addEventListener('error', () => {
      reject(new Error('Image dimensions could not be read.'));
    });
    image.src = src;
  });
}

function readVideoSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', () => {
      resolve({ width: video.videoWidth || 16, height: video.videoHeight || 9 });
    });
    video.addEventListener('error', () => {
      reject(new Error('Video dimensions could not be read.'));
    });
    video.src = src;
  });
}

function getMediaAssetType(file: File): 'image' | 'gif' | 'video' {
  if (file.type === 'image/gif') return 'gif';
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
}

function waitForNextPaint() {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function isDomError(error: unknown, name: string) {
  return (
    (error instanceof DOMException && error.name === name) ||
    (typeof error === 'object' && error !== null && 'name' in error && error.name === name)
  );
}

async function pickPowerPointImportInput(): Promise<PptxImportInput | null> {
  if (typeof window === 'undefined') return null;
  const pickerWindow = window as WindowWithPowerPointPicker;
  if (pickerWindow.showOpenFilePicker) {
    try {
      pptxImportLogger.info('Opening PowerPoint file picker.');
      const handles = await pickerWindow.showOpenFilePicker({
        excludeAcceptAllOption: false,
        multiple: false,
        types: [
          {
            description: 'PowerPoint presentation',
            accept: {
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
              'application/zip': ['.pptx'],
            },
          },
        ],
      });
      const handle = handles[0];
      if (!handle) return null;
      pptxImportLogger.info('PowerPoint file handle selected.', { name: handle.name });
      const file = await handle.getFile();
      pptxImportLogger.info('PowerPoint file handle read.', {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      return { file };
    } catch (error) {
      if (isDomError(error, 'AbortError')) {
        pptxImportLogger.info('PowerPoint file picker was cancelled.');
        return null;
      }
      pptxImportLogger.error('PowerPoint file picker failed.', error);
      throw error;
    }
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const file = await new Promise<File | undefined>((resolve) => {
    input.addEventListener('change', () => resolve(input.files?.[0]));
    input.click();
  });
  if (file) return { file };
  return null;
}

function getMinimumTextHeight(text: string, fontSize: number) {
  const lineCount = Math.max(1, text.split('\n').length);
  return Math.ceil(lineCount * fontSize * 1.08 + Math.max(12, fontSize * 0.18));
}

function getPageTextSample(project: ProjectDocument, pageId: string) {
  const page = project.pages.find((item) => item.id === pageId);
  if (!page) return '';
  return page.elementIds
    .map((elementId) => project.elements[elementId])
    .filter((element): element is Extract<ProjectDocument['elements'][string], { type: 'text' }> =>
      Boolean(element && element.type === 'text' && element.visible !== false && !element.locked),
    )
    .map((element) => element.text.trim())
    .filter(Boolean)
    .join('\n');
}

type TranslationScope = 'selection' | 'slide' | 'deck';
type TranslationPatch = {
  fontSize?: number;
  height?: number;
  text: string;
  width?: number;
  x?: number;
};

function normalizeTranslatedText(originalText: string, translatedText: string) {
  if (originalText.includes('\n')) return translatedText.trim();
  return translatedText.replace(/\s+/g, ' ').trim();
}

function estimateSingleLineTextWidth(text: string, fontSize: number) {
  return Array.from(text).reduce((width, character) => {
    if (character === ' ') return width + fontSize * 0.32;
    if (/[A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÄËÏÖÜÇÑ]/.test(character)) return width + fontSize * 0.68;
    if (/[ilI.,'’|]/.test(character)) return width + fontSize * 0.34;
    return width + fontSize * 0.58;
  }, 0);
}

function fitTranslatedTextToOriginalFrame(
  element: Extract<ProjectDocument['elements'][string], { type: 'text' }>,
  translatedText: string,
  page?: Page,
): TranslationPatch {
  const normalizedText = normalizeTranslatedText(element.text, translatedText);
  if (normalizedText.includes('\n')) return { text: normalizedText };

  const horizontalPadding = 12;
  const availableWidth = Math.max(1, element.width - horizontalPadding);
  const estimatedWidth = estimateSingleLineTextWidth(normalizedText, element.fontSize);
  if (estimatedWidth <= availableWidth) return { text: normalizedText };

  const desiredWidth = Math.ceil(estimatedWidth + horizontalPadding);
  const originalCenter = element.x + element.width / 2;
  const pageWidth =
    page?.width ?? Math.max(element.x + desiredWidth, originalCenter + desiredWidth / 2);
  const maxWidthAroundCenter = Math.max(
    1,
    2 * Math.min(originalCenter, pageWidth - originalCenter),
  );
  const nextWidth = Math.max(element.width, Math.min(desiredWidth, maxWidthAroundCenter));
  const nextX = Math.max(0, Math.min(pageWidth - nextWidth, originalCenter - nextWidth / 2));

  if (nextWidth >= desiredWidth) {
    return {
      text: normalizedText,
      width: nextWidth,
      x: nextX,
    };
  }

  const estimatedLineCount = Math.max(
    1,
    Math.ceil(estimatedWidth / Math.max(1, nextWidth - horizontalPadding)),
  );
  return {
    text: normalizedText,
    width: nextWidth,
    x: nextX,
    height: Math.max(element.height, Math.ceil(estimatedLineCount * element.fontSize * 1.08)),
  };
}

export function useEditorViewModel(services: AppServices) {
  const initialProject = useMemo(
    () => normalizeProjectDocument(services.initialProject),
    [services.initialProject],
  );
  const storedMirrorConfig = useMemo(
    () => services.mirrorService.loadConfig(),
    [services.mirrorService],
  );
  const shouldRestoreStoredProject = useMemo(
    () =>
      !services.skipStoredProjectLoad &&
      (editorPreferences.readPersistencePreference() || Boolean(storedMirrorConfig)),
    [services.skipStoredProjectLoad, storedMirrorConfig],
  );
  const [project, setProject] = useState<ProjectDocument>(initialProject);
  const projectRef = useRef(project);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('layout');
  const [modelStates, setModelStates] = useState<ModelState[]>([]);
  const [hasLoadedProject, setHasLoadedProject] = useState(!shouldRestoreStoredProject);
  const [persistenceEnabled, setPersistenceEnabled] = useState(shouldRestoreStoredProject);
  const [presentationImportProgress, setPresentationImportProgress] = useState<
    PresentationImportProgressState | undefined
  >();
  const [hasPersistedLocalProject, setHasPersistedLocalProject] = useState(
    shouldRestoreStoredProject,
  );
  const [activePageId, setActivePageId] = useState(initialProject.pages[0]?.id ?? '');
  const activePageIdRef = useRef(activePageId);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const selectedElementIdsRef = useRef(selectedElementIds);
  const [history, setHistory] = useState<EditorHistory>({ past: [], future: [] });
  const [zoomPercent, setZoomPercent] = useState(100);
  const [pagesPanelOpen, setPagesPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [backgroundSelectionMode, setBackgroundSelectionMode] = useState(false);
  const [backgroundSelectionNotice, setBackgroundSelectionNotice] = useState<string | undefined>();
  const [processingElementIds, setProcessingElementIds] = useState<string[]>([]);
  const [backgroundPreview, setBackgroundPreview] = useState<BackgroundPreviewState | undefined>();
  const [backgroundPreparation, setBackgroundPreparation] = useState<
    BackgroundPreparationState | undefined
  >();
  const [translationTargetLanguage, setTranslationTargetLanguageState] = useState(
    editorPreferences.readTranslationTargetLanguage,
  );
  const [promptProviderStates, setPromptProviderStates] = useState<AiProviderState[]>([]);
  const [translationProviderStates, setTranslationProviderStates] = useState<AiProviderState[]>([]);
  const [languageDetectionProviderStates, setLanguageDetectionProviderStates] = useState<
    AiProviderState[]
  >([]);
  const [translationTargetAttention, setTranslationTargetAttention] = useState(false);
  const [translationPreparation, setTranslationPreparation] = useState<TranslationPreparationState>(
    {
      progress: 0,
      status: editorPreferences.readTranslationTargetLanguage() ? 'ready' : 'idle',
    },
  );
  const [languageDetectionPreparation, setLanguageDetectionPreparation] =
    useState<TranslationPreparationState>({
      progress: 0,
      status: 'idle',
    });
  const [promptPreparation, setPromptPreparation] = useState<PromptPreparationState>({
    availability: 'unavailable',
    progress: 0,
    status: 'idle',
  });
  const [promptApiAttention, setPromptApiAttention] = useState(false);
  const [promptApiNotice, setPromptApiNotice] = useState<string | undefined>();
  const [promptGenerationNotice, setPromptGenerationNotice] = useState<string | undefined>();
  const [promptGenerationStatus, setPromptGenerationStatus] = useState<string | undefined>();
  const [isGeneratingSlide, setIsGeneratingSlide] = useState(false);
  const [createImageNotice, setCreateImageNotice] = useState<string | undefined>();
  const [createImageStatus, setCreateImageStatus] = useState<string | undefined>();
  const [createImageOptions, setCreateImageOptions] = useState<CreateImagePromptOptions>(
    imagePromptOptions.defaultCreateImagePromptOptions,
  );
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aiToolsAttentionModelId, setAiToolsAttentionModelId] = useState<string | undefined>();
  const [pageLanguageCodes, setPageLanguageCodes] = useState<Record<string, string>>({});
  const promptGenerationRunIdRef = useRef(0);
  const [elementClipboard, setElementClipboard] = useState<ElementClipboardState>({
    assets: {},
    elements: [],
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationNotice, setTranslationNotice] = useState<string | undefined>();
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryEntries, setVersionHistoryEntries] = useState<VersionHistoryEntry[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>();
  const [previewProject, setPreviewProject] = useState<ProjectDocument | undefined>();
  const [highlightVersionChanges, setHighlightVersionChanges] = useState(true);
  const [lastEditedAt, setLastEditedAt] = useState<string | undefined>(initialProject.updatedAt);
  const [saveAnimationKey, setSaveAnimationKey] = useState(0);
  const [mirrorState, setMirrorState] = useState<MirrorState>(() => ({
    enabled: Boolean(storedMirrorConfig),
    status: storedMirrorConfig ? 'idle' : 'disabled',
  }));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mirrorSettingsOpen, setMirrorSettingsOpen] = useState(false);
  const [mediaSettingsOpen, setMediaSettingsOpen] = useState(false);
  const [stockMediaConfig, setStockMediaConfig] = useState<StockMediaConfig | null>(() =>
    services.stockMediaService.loadConfig(),
  );
  const [stockMediaProviderState, setStockMediaProviderState] = useState<StockMediaProviderState>(
    () => services.stockMediaService.getProviderState(),
  );
  const [stockImageResults, setStockImageResults] = useState<StockMediaItem[]>([]);
  const [stockGifResults, setStockGifResults] = useState<StockMediaItem[]>([]);
  const [stockMediaRecentItems, setStockMediaRecentItems] = useState<StockMediaItem[]>([]);
  const [stockMediaSearching, setStockMediaSearching] = useState<StockMediaSearchState>({
    gifs: false,
    images: false,
  });
  const [stockMediaError, setStockMediaError] = useState<StockMediaErrorState>({});
  const [mirrorDisabledBySettings, setMirrorDisabledBySettings] = useState(false);
  const [remoteImportOpen, setRemoteImportOpen] = useState(false);
  const [localProjectSetupOpen, setLocalProjectSetupOpen] = useState(false);
  const [persistenceAttention, setPersistenceAttention] = useState(false);
  const [persistenceNotice, setPersistenceNotice] = useState<string | undefined>();
  const [remoteImportStatus, setRemoteImportStatus] = useState<RemoteImportStatus>('loading');
  const [remoteImportProjects, setRemoteImportProjects] = useState<MirrorProjectSummary[]>([]);
  const [remoteImportError, setRemoteImportError] = useState<string | undefined>();
  const [mirrorConfig, setMirrorConfig] = useState<MinioMirrorConfig>(
    () => storedMirrorConfig ?? minioMirrorService.DEFAULT_MINIO_MIRROR_CONFIG,
  );
  const [hasMirrorConfig, setHasMirrorConfig] = useState(Boolean(storedMirrorConfig));
  const mirrorConfigRef = useRef<MinioMirrorConfig | null>(storedMirrorConfig);
  const mirrorSyncInFlightRef = useRef(false);
  const mirrorSyncQueuedRef = useRef(false);
  const lastMirroredProjectNameRef = useRef<string | undefined>(undefined);
  const mirrorDebounceRef = useRef<number | undefined>(undefined);
  const queueMirrorSyncRef = useRef<() => void>(() => undefined);
  const syncMirrorNowRef = useRef<(project?: ProjectDocument) => void>(() => undefined);
  const [, setBackgroundSelectionPoints] = useState<Record<string, BackgroundSelectionPoint[]>>({});
  projectRef.current = project;
  activePageIdRef.current = activePageId;
  selectedElementIdsRef.current = selectedElementIds;
  mirrorConfigRef.current = hasMirrorConfig ? mirrorConfig : null;
  queueMirrorSyncRef.current = queueMirrorSync;
  syncMirrorNowRef.current = (projectToSync) => {
    void syncMirrorNow(projectToSync);
  };
  const backgroundSelectionPointsRef = useRef<Record<string, BackgroundSelectionPoint[]>>({});
  const backgroundPreviewTimeoutRef = useRef<number | undefined>(undefined);
  const wasFullscreenRef = useRef(false);
  const backgroundPreviewSequenceRef = useRef(0);
  const backgroundPreparationSequenceRef = useRef(0);
  const languageDetectionSequenceRef = useRef(0);
  const skipNextProjectSaveRef = useRef(shouldRestoreStoredProject);
  const lastVersionProjectRef = useRef<ProjectDocument>(initialProject);
  const selection = useMemo<SelectionState>(
    () => ({ pageId: activePageId, elementIds: selectedElementIds }),
    [activePageId, selectedElementIds],
  );
  const selectedImageElement = useMemo<ImageElement | undefined>(() => {
    if (selectedElementIds.length !== 1) return undefined;
    const element = project.elements[selectedElementIds[0] ?? ''];
    return element?.type === 'image' ? element : undefined;
  }, [project.elements, selectedElementIds]);
  useEffect(() => {
    if (stockMediaProviderState.images.configured && stockImageResults.length === 0) {
      void searchStockImages('');
    }
    if (stockMediaProviderState.gifs.configured && stockGifResults.length === 0) {
      void searchStockGifs('');
    }
  }, [
    stockGifResults.length,
    stockImageResults.length,
    stockMediaProviderState.gifs.configured,
    stockMediaProviderState.images.configured,
  ]);
  const activeSlideLanguage = useMemo(() => {
    const option = translationLanguageUtils.getLanguageOption(pageLanguageCodes[activePageId]);
    return {
      code: option.code,
      displayCode: translationLanguageUtils.getLanguageDisplayCode(option.code),
      flag: option.flag,
      label: option.label,
    };
  }, [activePageId, pageLanguageCodes]);
  const {
    animationPreview,
    advanceAnimationPreview,
    advancePresentationPreview,
    clearAnimationPreview,
    playAnimationPreview,
    playPresentationPreview,
    rewindPresentationPreview,
  } = useAnimationPreviewController({
    activePageIdRef,
    projectRef,
    setActivePageId,
    setSelectedElementIds,
  });
  const animationPreviewRef = useRef(animationPreview);
  animationPreviewRef.current = animationPreview;

  useEffect(() => {
    async function refreshAiReadiness() {
      const nextModelStates = await services.modelSetupService.getModelStates();
      setModelStates(nextModelStates);
      if (services.promptService.getProviderStates) {
        setPromptProviderStates(await services.promptService.getProviderStates());
      }
      if (services.translatorService.getProviderStates) {
        setTranslationProviderStates(await services.translatorService.getProviderStates());
      }
      if (services.translatorService.getLanguageDetectionProviderStates) {
        setLanguageDetectionProviderStates(
          await services.translatorService.getLanguageDetectionProviderStates(),
        );
      }
    }

    void refreshAiReadiness();
  }, [services.modelSetupService, services.promptService, services.translatorService]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    function handleFullscreenChange() {
      const isFullscreenActive = Boolean(document.fullscreenElement);
      setIsFullscreen(isFullscreenActive);
      if (wasFullscreenRef.current && !isFullscreenActive) {
        const previewPageId = animationPreviewRef.current?.pageId ?? activePageIdRef.current;
        if (previewPageId && projectRef.current.pages.some((page) => page.id === previewPageId)) {
          setActivePageId(previewPageId);
        }
        clearAnimationPreview();
        setSelectedElementIds([]);
      }
      wasFullscreenRef.current = isFullscreenActive;
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [clearAnimationPreview]);

  useEffect(() => {
    let isMounted = true;
    void services.promptService.checkAvailability().then((availability) => {
      if (!isMounted) return;
      setPromptPreparation((current) => {
        if (current.status === 'ready') return current;
        return {
          availability,
          progress: availability === 'ready' ? 100 : 0,
          status: availability === 'ready' ? 'ready' : 'idle',
        };
      });
    });
    return () => {
      isMounted = false;
    };
  }, [services.promptService]);

  useEffect(() => {
    let isMounted = true;

    if (!persistenceEnabled) return;

    void services.projectRepository
      .loadProject(
        services.storedProjectName ? { projectName: services.storedProjectName } : undefined,
      )
      .then((savedProject) => {
        if (!isMounted) return;
        if (savedProject) {
          const normalizedProject = normalizeProjectDocument(savedProject);
          setProject(normalizedProject);
          setActivePageId(normalizedProject.pages[0]?.id ?? '');
          setPageLanguageCodes({});
          setSelectedElementIds([]);
          lastVersionProjectRef.current = normalizedProject;
          setLastEditedAt(normalizedProject.updatedAt);
          if (services.projectRepository.getVersionHistory) {
            void services.projectRepository
              .getVersionHistory()
              .then(setVersionHistoryEntries)
              .catch(() => undefined);
          }
          writeProjectNameToUrl(normalizedProject.name);
          setHasPersistedLocalProject(true);
          if (storedMirrorConfig) syncMirrorNowRef.current(normalizedProject);
        }
        setHasLoadedProject(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setPersistenceEnabled(false);
        setHasLoadedProject(true);
        if (typeof window !== 'undefined') {
          editorPreferences.writePersistencePreference(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    persistenceEnabled,
    services.projectRepository,
    services.storedProjectName,
    storedMirrorConfig,
  ]);

  useEffect(() => {
    if (!hasLoadedProject || !persistenceEnabled) return;
    if (skipNextProjectSaveRef.current) {
      skipNextProjectSaveRef.current = false;
      return;
    }
    void services.projectRepository
      .saveProject(project)
      .then(async () => {
        setHasPersistedLocalProject(true);
        setLastEditedAt(project.updatedAt);
        setSaveAnimationKey((current) => current + 1);
        if (!services.projectRepository.saveVersion) return;
        const entry = await services.projectRepository.saveVersion(project, {
          previousProject: lastVersionProjectRef.current,
        });
        lastVersionProjectRef.current = project;
        setLastEditedAt(entry.createdAt);
        setVersionHistoryEntries((current) => [
          entry,
          ...current.filter((item) => item.id !== entry.id),
        ]);
      })
      .then(() => {
        queueMirrorSyncRef.current();
        writeProjectNameToUrl(project.name);
      })
      .catch(() => {
        setPersistenceEnabled(false);
        if (typeof window !== 'undefined') {
          editorPreferences.writePersistencePreference(false);
        }
      });
  }, [hasLoadedProject, persistenceEnabled, project, services.projectRepository]);

  useEffect(() => {
    return () => {
      if (mirrorDebounceRef.current !== undefined) {
        window.clearTimeout(mirrorDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pageLanguageCodes[activePageId]) return;
    const sampleText = getPageTextSample(project, activePageId);
    if (!sampleText) return;

    const sequence = languageDetectionSequenceRef.current + 1;
    languageDetectionSequenceRef.current = sequence;

    void services.translatorService
      .detectLanguage(sampleText, { allowModelPreparation: false })
      .then((languageCode) => {
        if (languageDetectionSequenceRef.current !== sequence) return;
        setPageLanguageCodes((current) => ({
          ...current,
          [activePageId]: translationLanguageUtils.normalizeLanguageCode(languageCode),
        }));
      })
      .catch(() => undefined);
  }, [activePageId, pageLanguageCodes, project, services.translatorService]);

  useEffect(
    () => () => {
      if (backgroundPreviewTimeoutRef.current !== undefined) {
        window.clearTimeout(backgroundPreviewTimeoutRef.current);
      }
    },
    [],
  );

  function clearBackgroundPreview() {
    backgroundPreviewSequenceRef.current += 1;
    if (backgroundPreviewTimeoutRef.current !== undefined) {
      window.clearTimeout(backgroundPreviewTimeoutRef.current);
      backgroundPreviewTimeoutRef.current = undefined;
    }
    setBackgroundPreview(undefined);
  }

  function clearBackgroundPreparation() {
    backgroundPreparationSequenceRef.current += 1;
    setBackgroundPreparation(undefined);
  }

  function clearBackgroundSelectionPoints(elementId?: string) {
    if (!elementId) {
      backgroundSelectionPointsRef.current = {};
      setBackgroundSelectionPoints({});
      return;
    }
    const { [elementId]: removed, ...remainingPoints } = backgroundSelectionPointsRef.current;
    void removed;
    backgroundSelectionPointsRef.current = remainingPoints;
    setBackgroundSelectionPoints(remainingPoints);
  }

  function replaceProjectForAutomation(nextProject: ProjectDocument) {
    const nextActivePageId = nextProject.pages[0]?.id ?? '';
    projectRef.current = nextProject;
    activePageIdRef.current = nextActivePageId;
    selectedElementIdsRef.current = [];
    setProject(nextProject);
    setActivePageId(nextActivePageId);
    setSelectedElementIds([]);
    setHistory({ past: [], future: [] });
    setPageLanguageCodes({});
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints();
    setPreviewProject(undefined);
    setSelectedVersionId(undefined);
    setVersionHistoryOpen(false);
    skipNextProjectSaveRef.current = true;
    lastVersionProjectRef.current = nextProject;
    setLastEditedAt(nextProject.updatedAt);
  }

  function isBackgroundPreparationReady(elementId: string) {
    return (
      backgroundPreparation?.elementId === elementId && backgroundPreparation.status === 'ready'
    );
  }

  async function downloadRequiredModels() {
    setModelStates((currentStates) =>
      currentStates.map((state) =>
        state.required && state.status !== 'ready'
          ? { ...state, status: 'downloading', progress: 10 }
          : state,
      ),
    );
    const next = await services.modelSetupService.downloadRequiredModels();
    setModelStates(next);
    if (services.promptService.getProviderStates) {
      setPromptProviderStates(await services.promptService.getProviderStates());
    }
    if (services.translatorService.getProviderStates) {
      setTranslationProviderStates(await services.translatorService.getProviderStates());
    }
    if (services.translatorService.getLanguageDetectionProviderStates) {
      setLanguageDetectionProviderStates(
        await services.translatorService.getLanguageDetectionProviderStates(),
      );
    }
    if (
      next.some(
        (state) =>
          state.id === modelSetupService.IMAGE_EDITING_MODEL_ID && state.status === 'ready',
      )
    ) {
      setBackgroundSelectionNotice(undefined);
    }
    if (
      next.some(
        (state) =>
          state.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID && state.status === 'ready',
      )
    ) {
      setCreateImageNotice(undefined);
      setAiToolsAttentionModelId(undefined);
    }
  }

  async function downloadModel(id: string) {
    setModelStates((currentStates) =>
      currentStates.map((state) =>
        state.id === id && state.status !== 'ready'
          ? { ...state, status: 'downloading', progress: 10 }
          : state,
      ),
    );
    const next = await services.modelSetupService.downloadModel(id, {
      onProgress: (progress, details) => {
        setModelStates((currentStates) =>
          currentStates.map((state) =>
            state.id === id
              ? { ...state, status: 'downloading', ...getDownloadProgressPatch(progress, details) }
              : state,
          ),
        );
      },
    });
    setModelStates((currentStates) =>
      currentStates.map((state) => (state.id === id ? next : state)),
    );
    if (services.promptService.getProviderStates) {
      setPromptProviderStates(await services.promptService.getProviderStates());
    }
    if (services.translatorService.getProviderStates) {
      setTranslationProviderStates(await services.translatorService.getProviderStates());
    }
    if (services.translatorService.getLanguageDetectionProviderStates) {
      setLanguageDetectionProviderStates(
        await services.translatorService.getLanguageDetectionProviderStates(),
      );
    }
    if (id === modelSetupService.IMAGE_EDITING_MODEL_ID && next.status === 'ready') {
      setBackgroundSelectionNotice(undefined);
    }
    if (id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID && next.status === 'ready') {
      setCreateImageNotice(undefined);
      setAiToolsAttentionModelId(undefined);
    }
  }

  async function removeModel(id: string) {
    if (!services.modelSetupService.removeModel) return;

    const selectedPromptProviderId = promptProviderStates.find(
      (provider) => provider.modelId === id && provider.selected,
    )?.id;
    const selectedTranslationProviderId = translationProviderStates.find(
      (provider) => provider.modelId === id && provider.selected,
    )?.id;
    const next = await services.modelSetupService.removeModel(id);
    setModelStates((currentStates) =>
      currentStates.map((state) => (state.id === id ? next : state)),
    );
    if (services.promptService.getProviderStates) {
      const nextPromptProviders =
        selectedPromptProviderId && services.promptService.setSelectedProvider
          ? await services.promptService.setSelectedProvider(selectedPromptProviderId)
          : await services.promptService.getProviderStates();
      setPromptProviderStates(nextPromptProviders);
    }
    if (services.translatorService.getProviderStates) {
      const nextTranslationProviders =
        selectedTranslationProviderId && services.translatorService.setSelectedProvider
          ? await services.translatorService.setSelectedProvider(selectedTranslationProviderId)
          : await services.translatorService.getProviderStates();
      setTranslationProviderStates(nextTranslationProviders);
    }
    if (id === aiModelCatalog.GEMMA_LLM_MODEL_ID) {
      setPromptPreparation({ availability: 'downloadable', progress: 0, status: 'idle' });
    }
    if (id === aiModelCatalog.TRANSLATEGEMMA_MODEL_ID) {
      setTranslationPreparation({ progress: 0, status: 'idle' });
    }
    if (id === aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID) {
      setLanguageDetectionPreparation({ progress: 0, status: 'idle' });
    }
  }

  function isImageGenerationReady() {
    return modelStates.some(
      (state) =>
        state.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID && state.status === 'ready',
    );
  }

  function ensureImageGenerationReadyForPrompt() {
    if (isImageGenerationReady()) {
      setCreateImageNotice(undefined);
      setAiToolsAttentionModelId(undefined);
      return true;
    }

    setActiveTab('ai-tools');
    setAiToolsAttentionModelId(imageGenerationModel.IMAGE_GENERATION_MODEL_ID);
    setCreateImageNotice(IMAGE_GENERATION_MODEL_REQUIRED_MESSAGE);
    return false;
  }

  async function refreshPromptApiAvailability() {
    const availability = await services.promptService.checkAvailability();
    setPromptPreparation((current) => ({
      availability,
      progress:
        availability === 'ready' ? 100 : current.status === 'downloading' ? current.progress : 0,
      status:
        availability === 'ready'
          ? 'ready'
          : current.status === 'downloading'
            ? 'downloading'
            : 'idle',
    }));
    return availability;
  }

  async function preparePromptApi() {
    setPromptApiNotice(undefined);
    setPromptApiAttention(false);
    setPromptPreparation((current) => ({
      ...current,
      progress: 4,
      status: 'downloading',
    }));
    try {
      await services.promptService.preparePromptApi({
        onProgress: (progress, details) => {
          setPromptPreparation((current) => ({
            ...current,
            availability: progress >= 100 ? 'ready' : current.availability,
            ...getDownloadProgressPatch(
              Math.max(current.progress, 4, Math.min(100, Math.round(progress))),
              details,
            ),
            status: progress >= 100 ? 'ready' : 'downloading',
          }));
        },
      });
      setPromptPreparation({ availability: 'ready', progress: 100, status: 'ready' });
      setModelStates(await services.modelSetupService.getModelStates());
      if (services.promptService.getProviderStates) {
        setPromptProviderStates(await services.promptService.getProviderStates());
      }
      setPromptApiNotice('Prompt API ready');
    } catch (error: unknown) {
      const selectedProvider = promptProviderStates.find((provider) => provider.selected);
      if (selectedProvider?.modelId) {
        await services.modelSetupService.removeModel?.(selectedProvider.modelId);
        setModelStates(await services.modelSetupService.getModelStates());
        if (services.promptService.getProviderStates) {
          setPromptProviderStates(await services.promptService.getProviderStates());
        }
      }
      setPromptPreparation({ availability: 'unavailable', progress: 0, status: 'failed' });
      setPromptApiAttention(true);
      setPromptApiNotice(
        error instanceof Error ? error.message : 'Chrome Prompt API could not be prepared.',
      );
    }
  }

  async function setPromptProvider(providerId: string) {
    if (!services.promptService.setSelectedProvider) return;
    const nextProviders = await services.promptService.setSelectedProvider(providerId);
    setPromptProviderStates(nextProviders);
    const selectedProvider = nextProviders.find((provider) => provider.selected);
    if (
      selectedProvider?.modelId &&
      selectedProvider.compatibility !== 'incompatible' &&
      selectedProvider.readiness !== 'ready'
    ) {
      await preparePromptApi();
      return;
    }
    await refreshPromptApiAvailability();
  }

  async function setTranslationProvider(providerId: string) {
    if (!services.translatorService.setSelectedProvider) return;
    const nextProviders = await services.translatorService.setSelectedProvider(providerId);
    setTranslationProviderStates(nextProviders);
    setTranslationPreparation((current) => ({
      ...current,
      progress: current.status === 'ready' ? 0 : current.progress,
      status: current.status === 'ready' ? 'idle' : current.status,
    }));
    const selectedProvider = nextProviders.find((provider) => provider.selected);
    if (
      selectedProvider?.modelId &&
      selectedProvider.compatibility !== 'incompatible' &&
      selectedProvider.readiness !== 'ready'
    ) {
      await prepareSelectedTranslationProvider(selectedProvider);
    }
  }

  async function setLanguageDetectionProvider(providerId: string) {
    if (!services.translatorService.setLanguageDetectionProvider) return;
    const nextProviders = await services.translatorService.setLanguageDetectionProvider(providerId);
    setLanguageDetectionProviderStates(nextProviders);
    setLanguageDetectionPreparation((current) => ({
      ...current,
      progress: current.status === 'ready' ? 0 : current.progress,
      status: current.status === 'ready' ? 'idle' : current.status,
    }));
    const selectedProvider = nextProviders.find((provider) => provider.selected);
    if (
      selectedProvider?.modelId &&
      selectedProvider.compatibility !== 'incompatible' &&
      selectedProvider.readiness !== 'ready'
    ) {
      await prepareSelectedLanguageDetectionProvider(selectedProvider);
    }
  }

  async function prepareSelectedLanguageDetectionProvider(providerState?: AiProviderState) {
    const selectedProvider =
      providerState ?? languageDetectionProviderStates.find((provider) => provider.selected);
    if (!selectedProvider?.modelId || selectedProvider.readiness === 'ready') return;

    setLanguageDetectionPreparation({ progress: 4, status: 'downloading' });
    try {
      await services.translatorService.prepareLanguageDetection?.({
        onProgress: (progress, details) => {
          setLanguageDetectionPreparation((current) => ({
            ...getDownloadProgressPatch(
              Math.max(current.progress, 4, Math.min(100, Math.round(progress))),
              details,
            ),
            status: progress >= 100 ? 'ready' : 'downloading',
          }));
        },
      });
      setLanguageDetectionPreparation({ progress: 100, status: 'ready' });
      setModelStates(await services.modelSetupService.getModelStates());
      if (services.translatorService.getLanguageDetectionProviderStates) {
        setLanguageDetectionProviderStates(
          await services.translatorService.getLanguageDetectionProviderStates(),
        );
      }
    } catch (error: unknown) {
      setLanguageDetectionPreparation({ progress: 0, status: 'failed' });
      setTranslationNotice(
        error instanceof Error ? error.message : 'Language detection model could not be prepared.',
      );
    }
  }

  async function prepareSelectedTranslationProvider(providerState?: AiProviderState) {
    const selectedProvider =
      providerState ?? translationProviderStates.find((provider) => provider.selected);
    if (selectedProvider?.modelId && selectedProvider.readiness !== 'ready') {
      setTranslationPreparation({ progress: 4, status: 'downloading' });
      try {
        await services.translatorService.prepareTranslation(
          'en',
          translationTargetLanguage || 'en',
          {
            onProgress: (progress, details) => {
              setTranslationPreparation((current) => ({
                ...getDownloadProgressPatch(
                  Math.max(current.progress, 4, Math.min(100, Math.round(progress))),
                  details,
                ),
                status: progress >= 100 ? 'ready' : 'downloading',
              }));
            },
          },
        );
        setTranslationPreparation({ progress: 100, status: 'ready' });
        setModelStates(await services.modelSetupService.getModelStates());
        if (services.translatorService.getProviderStates) {
          setTranslationProviderStates(await services.translatorService.getProviderStates());
        }
      } catch (error) {
        if (selectedProvider?.modelId) {
          await services.modelSetupService.removeModel?.(selectedProvider.modelId);
          setModelStates(await services.modelSetupService.getModelStates());
          if (services.translatorService.getProviderStates) {
            setTranslationProviderStates(await services.translatorService.getProviderStates());
          }
        }
        setTranslationPreparation({ progress: 0, status: 'failed' });
        setTranslationNotice(
          error instanceof Error ? error.message : 'Translation model could not be prepared.',
        );
      }
    }
    if (translationTargetLanguage) {
      await setTranslationTargetLanguage(translationTargetLanguage);
    }
  }

  async function ensurePromptApiReadyForPrompt() {
    if (promptPreparation.status === 'ready') {
      setPromptApiAttention(false);
      setPromptApiNotice(undefined);
      return true;
    }

    const availability =
      promptPreparation.status === 'downloading'
        ? promptPreparation.availability
        : await refreshPromptApiAvailability();
    if (availability === 'ready') {
      setPromptApiAttention(false);
      setPromptApiNotice(undefined);
      return true;
    }

    setActiveTab('ai-tools');
    setPromptApiAttention(true);
    setPromptApiNotice(PROMPT_API_REQUIRED_MESSAGE);
    return false;
  }

  async function generateSlideFromPrompt(prompt: string) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isGeneratingSlide || isGeneratingImage) return;
    const runId = promptGenerationRunIdRef.current + 1;
    promptGenerationRunIdRef.current = runId;
    const isCurrentRun = () => promptGenerationRunIdRef.current === runId;

    if (slideTaskPrompt.looksLikeImageGenerationRequest(trimmedPrompt)) {
      setPromptGenerationStatus(undefined);
      setPromptGenerationNotice(IMAGE_PROMPT_MODE_REQUIRED_MESSAGE);
      return;
    }

    const isReady = await ensurePromptApiReadyForPrompt();
    if (!isReady) return;

    setPromptGenerationNotice(undefined);
    setIsGeneratingSlide(true);
    try {
      setPromptGenerationStatus('Planning slide...');
      const generatedTasks = await services.promptService.generateSlideTasksFromPrompt(
        trimmedPrompt,
        {
          targetLanguageHint: 'same as user prompt',
        },
      );
      if (!isCurrentRun()) return;
      const pageId = activePageId;

      commitProject(
        (currentProject) =>
          new basicCommands.PrepareGeneratedSlideCommand(pageId, generatedTasks.page).execute(
            currentProject,
          ),
        { activePageId: pageId, selectedElementIds: [] },
      );

      const generatedElements: GeneratedSlideElement[] = [];
      for (const task of generatedTasks.tasks) {
        if (task.type === 'set-background') continue;

        setPromptGenerationStatus(`Adding ${task.type.replace('add-', '').replace('-', ' ')}...`);
        const element = await services.promptService.generateSlideElementFromTask(task, {
          userPrompt: trimmedPrompt,
          allTasks: generatedTasks.tasks,
          page: generatedTasks.page,
          existingElements: generatedElements,
        });
        if (!isCurrentRun()) return;
        generatedElements.push(element);
        const selectedElementId = `generated-${pageId}-${element.id.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()}`;
        commitProject(
          (currentProject) =>
            new basicCommands.AddGeneratedSlideElementCommand(pageId, element).execute(
              currentProject,
            ),
          { activePageId: pageId, selectedElementIds: [selectedElementId] },
        );
      }

      setPageLanguageCodes((current) => ({
        ...current,
        [pageId]: translationLanguageUtils.normalizeLanguageCode(generatedTasks.language),
      }));
    } catch (error: unknown) {
      if (!isCurrentRun()) return;
      setPromptGenerationNotice(
        error instanceof Error ? error.message : 'Prompt API could not generate the slide.',
      );
    } finally {
      if (isCurrentRun()) {
        setPromptGenerationStatus(undefined);
        setIsGeneratingSlide(false);
      }
    }
  }

  async function generateImageFromPrompt(prompt: string, options?: CreateImagePromptOptions) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isGeneratingImage || isGeneratingSlide) return;
    const imageToReplace = selectedImageElement;
    const runId = promptGenerationRunIdRef.current + 1;
    promptGenerationRunIdRef.current = runId;
    const isCurrentRun = () => promptGenerationRunIdRef.current === runId;

    const isReady = ensureImageGenerationReadyForPrompt();
    if (!isReady) return;

    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    setCreateImageNotice(undefined);
    setCreateImageStatus(imageToReplace ? 'Generating replacement...' : 'Generating image...');
    setIsGeneratingImage(true);
    try {
      const generationOptions = {
        height: normalizeImageGenerationDimension(
          imageToReplace?.height ??
            options?.height ??
            imageGenerationModel.DEFAULT_IMAGE_GENERATION_SIZE,
        ),
        ...(options?.seed !== undefined ? { seed: options.seed } : {}),
        ...(options?.steps !== undefined ? { steps: options.steps } : {}),
        width: normalizeImageGenerationDimension(
          imageToReplace?.width ??
            options?.width ??
            imageGenerationModel.DEFAULT_IMAGE_GENERATION_SIZE,
        ),
      };
      const asset = await services.imageGenerationService.generateImage(trimmedPrompt, {
        ...generationOptions,
        onProgress: (state) => {
          if (!isCurrentRun()) return;
          setCreateImageStatus(`${state.label} ${state.progress}%`);
        },
      });
      if (!isCurrentRun()) return;
      if (imageToReplace) {
        commitProject(
          (currentProject) =>
            new basicCommands.ReplaceImageAssetCommand(imageToReplace.id, asset).execute(
              currentProject,
            ),
          { selectedElementIds: [imageToReplace.id] },
        );
        return;
      }

      const elementId = createPrefixedId('image-generated');
      const fittedImage = fitImageWithinPage({
        imageWidth: generationOptions.width,
        imageHeight: generationOptions.height,
        pageWidth: page.width,
        pageHeight: page.height,
      });

      commitProject(
        (currentProject) =>
          new basicCommands.AddImageElementCommand(activePageId, {
            asset,
            element: {
              id: elementId,
              type: 'image',
              assetId: asset.id,
              x: fittedImage.x,
              y: fittedImage.y,
              width: fittedImage.width,
              height: fittedImage.height,
              rotation: 0,
              locked: false,
              visible: true,
              opacity: 1,
            },
          }).execute(currentProject),
        { selectedElementIds: [elementId] },
      );
    } catch (error: unknown) {
      if (!isCurrentRun()) return;
      setCreateImageNotice(error instanceof Error ? error.message : 'Image generation failed.');
    } finally {
      if (isCurrentRun()) {
        setCreateImageStatus(undefined);
        setIsGeneratingImage(false);
      }
    }
  }

  function stopPromptGeneration() {
    promptGenerationRunIdRef.current += 1;
    if (isGeneratingSlide) {
      setPromptGenerationStatus(undefined);
      setPromptGenerationNotice('Slide generation stopped.');
      setIsGeneratingSlide(false);
    }
    if (isGeneratingImage) {
      setCreateImageStatus(undefined);
      setCreateImageNotice('Image generation stopped.');
      setIsGeneratingImage(false);
    }
  }

  function commitProject(
    updater: (currentProject: ProjectDocument) => ProjectDocument,
    options?: { activePageId?: string; selectedElementIds?: string[] },
  ) {
    if (versionHistoryOpen || previewProject) return;
    setProject((currentProject) => {
      const nextProject = updater(currentProject);
      if (nextProject === currentProject) return currentProject;
      projectRef.current = nextProject;

      setHistory((currentHistory) => ({
        past: [...currentHistory.past, currentProject].slice(-50),
        future: [],
      }));

      if (options?.activePageId !== undefined) {
        activePageIdRef.current = options.activePageId;
        setActivePageId(options.activePageId);
      }
      if (options?.selectedElementIds !== undefined) {
        selectedElementIdsRef.current = options.selectedElementIds;
        setSelectedElementIds(options.selectedElementIds);
      }
      return nextProject;
    });
  }

  function getSelectionForProject(
    nextProject: ProjectDocument,
    pageId: string,
    currentSelection: string[],
  ) {
    const page = nextProject.pages.find((item) => item.id === pageId) ?? nextProject.pages[0];
    const retainedSelection = currentSelection.filter((id) => page?.elementIds.includes(id));
    if (retainedSelection.length > 0) return retainedSelection;
    const nextSelectedId = page?.elementIds.at(-1);
    return nextSelectedId ? [nextSelectedId] : [];
  }

  function selectElement(elementId: string, options?: { additive?: boolean }) {
    if (processingElementIds.includes(elementId)) return;
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints();
    setSelectedElementIds((currentSelection) => {
      if (!options?.additive) return [elementId];
      if (currentSelection.includes(elementId)) {
        return currentSelection.filter((id) => id !== elementId);
      }
      return [...currentSelection, elementId];
    });
  }

  function selectAllElementsOnActivePage() {
    const page = project.pages.find((item) => item.id === activePageId);
    if (!page) return;
    const selectableElementIds = page.elementIds.filter((elementId) => {
      const element = project.elements[elementId];
      return element && element.visible !== false && !processingElementIds.includes(elementId);
    });
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints();
    setSelectedElementIds(selectableElementIds);
  }

  function clearSelection() {
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints();
    setSelectedElementIds([]);
  }

  function setProjectName(name: string) {
    const nextName = name.trim();
    if (!nextName) return;
    commitProject((currentProject) => ({
      ...currentProject,
      name: nextName,
      updatedAt: new Date().toISOString(),
    }));
  }

  function setPersistence(nextEnabled: boolean) {
    if (!nextEnabled) {
      setPersistenceEnabled(false);
      setLocalProjectSetupOpen(false);
      setPersistenceAttention(false);
      setPersistenceNotice(undefined);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
      return;
    }

    if (hasPersistedLocalProject) {
      void reenablePersistence();
      return;
    }

    if (services.persistenceMode === 'opfs') {
      void reenablePersistence();
      return;
    }

    setLocalProjectSetupOpen(true);
  }

  async function reenablePersistence() {
    try {
      const projectToSave = projectRef.current;
      await services.projectRepository.saveProject(projectToSave);
      lastVersionProjectRef.current = projectToSave;
      setHasPersistedLocalProject(true);
      setLastEditedAt(projectToSave.updatedAt);
      setSaveAnimationKey((current) => current + 1);
      skipNextProjectSaveRef.current = true;
      setPersistenceEnabled(true);
      setPersistenceAttention(false);
      setPersistenceNotice(undefined);
      setLocalProjectSetupOpen(false);
      writeProjectNameToUrl(projectToSave.name);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(true);
      }
    } catch {
      setPersistenceEnabled(false);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
    }
  }

  async function persistCurrentProject(projectToSave = projectRef.current) {
    await services.projectRepository.saveProject(projectToSave);
    setHasPersistedLocalProject(true);
    const previousProject = lastVersionProjectRef.current;
    lastVersionProjectRef.current = projectToSave;
    setLastEditedAt(projectToSave.updatedAt);
    setSaveAnimationKey((current) => current + 1);
    if (!services.projectRepository.saveVersion) return;
    const entry = await services.projectRepository.saveVersion(projectToSave, {
      previousProject,
      force: true,
    });
    setLastEditedAt(entry.createdAt);
    setVersionHistoryEntries((current) => [
      entry,
      ...current.filter((item) => item.id !== entry.id),
    ]);
  }

  async function saveLocalNow() {
    if (!persistenceEnabled) {
      setPersistence(true);
      return;
    }
    try {
      await persistCurrentProject();
      writeProjectNameToUrl(projectRef.current.name);
    } catch {
      setPersistenceEnabled(false);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
    }
  }

  async function saveLocalAs() {
    const projectToSave = projectRef.current;
    try {
      if (services.projectRepository.saveProjectAs) {
        await services.projectRepository.saveProjectAs(projectToSave, {
          projectDirectoryName: projectToSave.name,
        });
      } else {
        await services.projectRepository.saveProject(projectToSave, {
          projectDirectoryName: projectToSave.name,
        });
      }
      lastVersionProjectRef.current = projectToSave;
      setHasPersistedLocalProject(true);
      setPersistenceEnabled(true);
      setPersistenceAttention(false);
      setPersistenceNotice(undefined);
      setLocalProjectSetupOpen(false);
      setLastEditedAt(projectToSave.updatedAt);
      setSaveAnimationKey((current) => current + 1);
      skipNextProjectSaveRef.current = true;
      writeProjectNameToUrl(projectToSave.name);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(true);
      }
    } catch {
      setPersistenceEnabled(false);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
    }
  }

  function closeLocalProjectSetup() {
    setLocalProjectSetupOpen(false);
  }

  async function confirmLocalProjectSetup(projectName: string) {
    const nextName = projectName.trim();
    if (!nextName) return;
    const nextProject = {
      ...projectRef.current,
      name: nextName,
      updatedAt: new Date().toISOString(),
    };
    try {
      await services.projectRepository.saveProject(nextProject, { projectDirectoryName: nextName });
      setProject(nextProject);
      lastVersionProjectRef.current = nextProject;
      setLastEditedAt(nextProject.updatedAt);
      setSaveAnimationKey((current) => current + 1);
      skipNextProjectSaveRef.current = true;
      setHasPersistedLocalProject(true);
      setPersistenceEnabled(true);
      setPersistenceAttention(false);
      setPersistenceNotice(undefined);
      setLocalProjectSetupOpen(false);
      writeProjectNameToUrl(nextProject.name);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(true);
      }
    } catch {
      setPersistenceEnabled(false);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
    }
  }

  async function importProject() {
    if (!services.projectRepository.importProject) return;
    try {
      const importedProject = await services.projectRepository.importProject();
      if (!importedProject) return;
      const normalizedProject = normalizeProjectDocument(importedProject);
      setProject(normalizedProject);
      setActivePageId(normalizedProject.pages[0]?.id ?? '');
      setPageLanguageCodes({});
      const nextSelectedId = normalizedProject.pages[0]?.elementIds.at(-1);
      setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
      setHistory({ past: [], future: [] });
      setBackgroundSelectionMode(false);
      setBackgroundSelectionNotice(undefined);
      clearBackgroundPreview();
      clearBackgroundPreparation();
      clearBackgroundSelectionPoints();
      skipNextProjectSaveRef.current = true;
      setHasPersistedLocalProject(true);
      setPersistenceEnabled(true);
      lastVersionProjectRef.current = normalizedProject;
      setLastEditedAt(normalizedProject.updatedAt);
      if (services.projectRepository.getVersionHistory) {
        void services.projectRepository
          .getVersionHistory()
          .then(setVersionHistoryEntries)
          .catch(() => undefined);
      }
      writeProjectNameToUrl(normalizedProject.name);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(true);
      }
    } catch {
      setPersistenceEnabled(false);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
    }
  }

  async function importPowerPoint(input?: PptxImportInput) {
    try {
      setPersistenceNotice(undefined);
      const pptxInput = input ?? (await pickPowerPointImportInput());
      if (!pptxInput) return;
      setPresentationImportProgress({
        detail: `Reading ${pptxInput.file.name}.`,
        progress: 18,
        stage: 'reading',
        title: 'Reading PowerPoint package',
      });
      await waitForNextPaint();
      setPresentationImportProgress({
        detail: 'Inspecting slide order, dimensions, and package relationships.',
        progress: 34,
        stage: 'inspecting',
        title: 'Inspecting PPTX structure',
      });
      await waitForNextPaint();
      const importedProject = await services.presentationImportService.importPowerPoint(pptxInput);
      setPresentationImportProgress({
        detail: `Extracting text and image objects for ${importedProject.pages.length.toLocaleString()} slides.`,
        progress: 58,
        stage: 'extracting-objects',
        title: 'Extracting text and images',
      });
      await waitForNextPaint();
      setPresentationImportProgress({
        detail: 'Linking original videos and GIFs from the PowerPoint package.',
        progress: 72,
        stage: 'extracting-media',
        title: 'Extracting videos',
      });
      await waitForNextPaint();
      setPresentationImportProgress({
        detail: 'Mapping imported transitions and object builds into preview playback.',
        progress: 84,
        stage: 'mapping-animations',
        title: 'Mapping animations',
      });
      await waitForNextPaint();
      const normalizedProject = normalizeProjectDocument(importedProject);
      setPresentationImportProgress({
        detail: 'Opening the imported project in the editor.',
        progress: 94,
        stage: 'opening',
        title: 'Opening deck',
      });
      await waitForNextPaint();
      setProject(normalizedProject);
      setActivePageId(normalizedProject.pages[0]?.id ?? '');
      setPageLanguageCodes({});
      const nextSelectedId = normalizedProject.pages[0]?.elementIds.at(-1);
      setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
      setHistory({ past: [], future: [] });
      setBackgroundSelectionMode(false);
      setBackgroundSelectionNotice(undefined);
      clearBackgroundPreview();
      clearBackgroundPreparation();
      clearBackgroundSelectionPoints();
      skipNextProjectSaveRef.current = true;
      setHasPersistedLocalProject(false);
      setPersistenceEnabled(false);
      lastVersionProjectRef.current = normalizedProject;
      setLastEditedAt(normalizedProject.updatedAt);
      setVersionHistoryEntries([]);
      writeProjectNameToUrl(normalizedProject.name);
      setPresentationImportProgress(undefined);
    } catch (error) {
      setPresentationImportProgress(undefined);
      pptxImportLogger.error('PowerPoint import failed.', error);
      const message = pptxImportLogger.describeError(error).message;
      setPersistenceNotice(`PowerPoint import failed: ${message}`);
    }
  }

  function openSettings() {
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
  }

  function openMediaSettings() {
    setSettingsOpen(false);
    setMediaSettingsOpen(true);
  }

  function closeMediaSettings() {
    setMediaSettingsOpen(false);
  }

  function openMirrorSettings() {
    setSettingsOpen(false);
    setMirrorSettingsOpen(true);
  }

  function closeMirrorSettings() {
    setMirrorSettingsOpen(false);
  }

  function closeRemoteImport() {
    setRemoteImportOpen(false);
  }

  function saveMirrorConfig(config: MinioMirrorConfig) {
    services.mirrorService.saveConfig(config);
    setMirrorConfig(config);
    setHasMirrorConfig(true);
    setMirrorDisabledBySettings(false);
    mirrorConfigRef.current = config;
    setMirrorState({ enabled: true, status: 'idle' });
    setMirrorSettingsOpen(false);
    void syncMirrorNow();
  }

  function refreshStockMediaConfig() {
    setStockMediaConfig(services.stockMediaService.loadConfig());
    setStockMediaProviderState(services.stockMediaService.getProviderState());
  }

  function saveStockMediaConfig(config: StockMediaConfig) {
    services.stockMediaService.saveConfig(config);
    refreshStockMediaConfig();
    setMediaSettingsOpen(false);
    void searchStockImages('');
    void searchStockGifs('');
  }

  function clearStockMediaConfig() {
    services.stockMediaService.clearConfig();
    refreshStockMediaConfig();
    setStockImageResults([]);
    setStockGifResults([]);
    setStockMediaError({});
  }

  function setMirrorEnabled(enabled: boolean, options?: { fromSettings?: boolean }) {
    if (enabled) {
      if (!mirrorConfigRef.current) {
        openMirrorSettings();
        return;
      }
      setMirrorDisabledBySettings(false);
      setMirrorState({ enabled: true, status: 'idle' });
      void syncMirrorNow();
      return;
    }
    setMirrorDisabledBySettings(Boolean(options?.fromSettings));
    setMirrorState({ enabled: false, status: 'disabled' });
  }

  function setMirrorEnabledFromSettings(enabled: boolean) {
    setMirrorEnabled(enabled, { fromSettings: true });
  }

  async function testMirrorConnection(config: MinioMirrorConfig) {
    setMirrorState({ enabled: true, status: 'syncing' });
    try {
      await services.mirrorService.listProjects(config);
      setMirrorState({ enabled: true, status: 'idle' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'MinIO connection failed.';
      setMirrorState({
        enabled: true,
        status: 'failed',
        error: message,
      });
      throw new Error(message, { cause: error });
    }
  }

  function queueMirrorSync() {
    if (!mirrorState.enabled || !mirrorConfigRef.current) return;
    if (typeof window === 'undefined') {
      void syncMirrorNow();
      return;
    }
    if (mirrorDebounceRef.current !== undefined) {
      window.clearTimeout(mirrorDebounceRef.current);
    }
    mirrorDebounceRef.current = window.setTimeout(() => {
      void syncMirrorNow();
    }, 750);
  }

  async function syncMirrorNow(projectToSync: ProjectDocument = projectRef.current) {
    const config = mirrorConfigRef.current;
    if (!config) {
      openMirrorSettings();
      return;
    }
    if (mirrorSyncInFlightRef.current) {
      mirrorSyncQueuedRef.current = true;
      return;
    }
    mirrorSyncInFlightRef.current = true;
    setMirrorState((current) => {
      const { error, ...rest } = current;
      void error;
      return { ...rest, enabled: true, status: 'syncing' };
    });
    try {
      const nextState = await services.mirrorService.syncProject(
        projectToSync,
        services.projectRepository,
        mirrorConfigRef.current!,
      );
      const previousMirroredProjectName = lastMirroredProjectNameRef.current;
      if (
        previousMirroredProjectName &&
        previousMirroredProjectName !== projectToSync.name &&
        services.mirrorService.deleteProject
      ) {
        await services.mirrorService.deleteProject(previousMirroredProjectName, config);
      }
      lastMirroredProjectNameRef.current = projectToSync.name;
      setMirrorState(nextState);
    } catch (error: unknown) {
      setMirrorState({
        enabled: true,
        status: 'failed',
        error: error instanceof Error ? error.message : 'MinIO mirror sync failed.',
      });
    } finally {
      mirrorSyncInFlightRef.current = false;
      if (mirrorSyncQueuedRef.current) {
        mirrorSyncQueuedRef.current = false;
        void syncMirrorNow();
      }
    }
  }

  function requestMirrorNow() {
    if (!persistenceEnabled) {
      setPersistenceAttention(true);
      setPersistenceNotice('Save the project before mirroring.');
      return;
    }
    if (!mirrorConfigRef.current) {
      openMirrorSettings();
      return;
    }
    if (!mirrorState.enabled) {
      setMirrorState({ enabled: true, status: 'idle' });
    }
    void syncMirrorNow();
  }

  async function importRemoteMirror() {
    const config = mirrorConfigRef.current;
    if (!config) {
      openMirrorSettings();
      return;
    }
    if (!config || !services.projectRepository.importMirrorFiles) return;
    setRemoteImportOpen(true);
    setRemoteImportStatus('loading');
    setRemoteImportError(undefined);
    try {
      const mirrors = await services.mirrorService.listProjects(config);
      if (mirrors.length === 0) {
        setRemoteImportProjects([]);
        setRemoteImportStatus('empty');
        return;
      }
      setRemoteImportProjects(mirrors);
      setRemoteImportStatus('ready');
    } catch (error: unknown) {
      setRemoteImportStatus('failed');
      setRemoteImportError(
        error instanceof Error ? error.message : 'Could not list mirrored projects.',
      );
      setMirrorState({
        enabled: Boolean(config),
        status: 'failed',
        error: error instanceof Error ? error.message : 'MinIO mirror import failed.',
      });
    }
  }

  async function importRemoteMirrorProject(projectId: string) {
    const config = mirrorConfigRef.current;
    if (!config || !services.projectRepository.importMirrorFiles) return;
    setRemoteImportStatus('importing');
    setRemoteImportError(undefined);
    try {
      const files = await services.mirrorService.downloadProject(projectId, config);
      const importedProject = await services.projectRepository.importMirrorFiles(files);
      const normalizedProject = normalizeProjectDocument(importedProject);
      setProject(normalizedProject);
      setActivePageId(normalizedProject.pages[0]?.id ?? '');
      setPageLanguageCodes({});
      setSelectedElementIds([]);
      setHistory({ past: [], future: [] });
      setBackgroundSelectionMode(false);
      setBackgroundSelectionNotice(undefined);
      clearBackgroundPreview();
      clearBackgroundPreparation();
      clearBackgroundSelectionPoints();
      skipNextProjectSaveRef.current = true;
      setHasPersistedLocalProject(true);
      setPersistenceEnabled(true);
      lastVersionProjectRef.current = normalizedProject;
      setLastEditedAt(normalizedProject.updatedAt);
      if (services.projectRepository.getVersionHistory) {
        void services.projectRepository
          .getVersionHistory()
          .then(setVersionHistoryEntries)
          .catch(() => undefined);
      }
      writeProjectNameToUrl(normalizedProject.name);
      editorPreferences.writePersistencePreference(true);
      setMirrorState({ enabled: true, status: 'synced', lastSyncedAt: new Date().toISOString() });
      setRemoteImportOpen(false);
    } catch (error: unknown) {
      setRemoteImportStatus('failed');
      setRemoteImportError(error instanceof Error ? error.message : 'MinIO mirror import failed.');
      setMirrorState({
        enabled: Boolean(config),
        status: 'failed',
        error: error instanceof Error ? error.message : 'MinIO mirror import failed.',
      });
    }
  }

  async function deleteRemoteMirrorProject(projectId: string) {
    const config = mirrorConfigRef.current;
    if (!config || !services.mirrorService.deleteProject) return;
    setRemoteImportStatus('deleting');
    setRemoteImportError(undefined);
    try {
      await services.mirrorService.deleteProject(projectId, config);
      let nextProjectCount = 0;
      setRemoteImportProjects((projects) => {
        const nextProjects = projects.filter((project) => project.id !== projectId);
        nextProjectCount = nextProjects.length;
        return nextProjects;
      });
      setRemoteImportStatus(nextProjectCount > 0 ? 'ready' : 'empty');
    } catch (error) {
      setRemoteImportStatus('failed');
      setRemoteImportError(
        error instanceof Error ? error.message : 'Could not delete mirrored project.',
      );
      setMirrorState({
        enabled: Boolean(config),
        status: 'failed',
        error: error instanceof Error ? error.message : 'MinIO mirror delete failed.',
      });
    }
  }

  async function openVersionHistory() {
    if (!services.projectRepository.getVersionHistory) return;
    setVersionHistoryOpen(true);
    setSelectedVersionId(undefined);
    setPreviewProject(undefined);
    const entries = await services.projectRepository.getVersionHistory();
    setVersionHistoryEntries(entries);
  }

  function closeVersionHistory() {
    setVersionHistoryOpen(false);
    setSelectedVersionId(undefined);
    setPreviewProject(undefined);
    setSelectedElementIds([]);
    setActivePageId(project.pages[0]?.id ?? '');
  }

  async function selectVersion(versionId: string, entryOverride?: VersionHistoryEntry) {
    if (!services.projectRepository.loadVersion) return;
    const entry = entryOverride ?? versionHistoryEntries.find((item) => item.id === versionId);
    const versionProject = await services.projectRepository.loadVersion(versionId);
    if (!versionProject) return;
    const normalizedVersionProject = normalizeProjectDocument(versionProject);
    setSelectedVersionId(versionId);
    setPreviewProject(normalizedVersionProject);
    const nextPageId = entry?.firstChangedPageId ?? normalizedVersionProject.pages[0]?.id ?? '';
    setActivePageId(nextPageId);
    setSelectedElementIds(entry?.firstChangedElementId ? [entry.firstChangedElementId] : []);
  }

  async function restoreVersion(versionId: string) {
    if (!services.projectRepository.loadVersion) return;
    const restoredProject = await services.projectRepository.loadVersion(versionId);
    if (!restoredProject) return;
    const normalizedProject = normalizeProjectDocument({
      ...restoredProject,
      updatedAt: new Date().toISOString(),
    });
    await services.projectRepository.saveProject(normalizedProject);
    setSaveAnimationKey((current) => current + 1);
    if (services.projectRepository.saveVersion) {
      const entry = await services.projectRepository.saveVersion(normalizedProject, {
        previousProject: project,
        force: true,
      });
      setVersionHistoryEntries((current) => [
        entry,
        ...current.filter((item) => item.id !== entry.id),
      ]);
      setLastEditedAt(entry.createdAt);
    }
    lastVersionProjectRef.current = normalizedProject;
    setProject(normalizedProject);
    setHistory({ past: [], future: [] });
    setPreviewProject(undefined);
    setSelectedVersionId(undefined);
    setVersionHistoryOpen(false);
    setActivePageId(normalizedProject.pages[0]?.id ?? '');
    setSelectedElementIds([]);
  }

  function selectPage(pageId: string) {
    const page = project.pages.find((item) => item.id === pageId);
    if (!page) return;
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints();
    setActivePageId(page.id);
    setSelectedElementIds([]);
  }

  function updateElementFrame(elementId: string, patch: ElementFramePatch) {
    commitProject((currentProject) => {
      const element = currentProject.elements[elementId];
      const nextPatch =
        element?.type === 'text'
          ? patch.height === undefined
            ? patch
            : {
                ...patch,
                height: Math.max(
                  patch.height,
                  getMinimumTextHeight(element.text, element.fontSize),
                ),
              }
          : patch;
      return new basicCommands.UpdateElementFrameCommand(elementId, nextPatch).execute(
        currentProject,
      );
    });
  }

  function updateElementFrames(patches: Record<string, ElementFramePatch>) {
    commitProject((currentProject) =>
      new basicCommands.UpdateElementFramesCommand(patches).execute(currentProject),
    );
  }

  function updateTextContent(elementId: string, text: string) {
    commitProject((currentProject) => {
      const nextProject = new basicCommands.UpdateTextContentCommand(elementId, text).execute(
        currentProject,
      );
      const element = nextProject.elements[elementId];
      if (!element || element.type !== 'text') return nextProject;
      const minimumHeight = getMinimumTextHeight(element.text, element.fontSize);
      if (element.height >= minimumHeight) return nextProject;
      return new basicCommands.UpdateElementFrameCommand(elementId, {
        height: minimumHeight,
      }).execute(nextProject);
    });
  }

  function updateElementStyle(elementId: string, patch: ElementStylePatch) {
    commitProject((currentProject) => {
      const nextProject = new basicCommands.UpdateElementStyleCommand(elementId, patch).execute(
        currentProject,
      );
      const element = nextProject.elements[elementId];
      if (!element || element.type !== 'text') return nextProject;
      const minimumHeight = getMinimumTextHeight(element.text, element.fontSize);
      if (element.height >= minimumHeight) return nextProject;
      return new basicCommands.UpdateElementFrameCommand(elementId, {
        height: minimumHeight,
      }).execute(nextProject);
    });
  }

  function updatePageBackground(background: PageBackground) {
    commitProject((currentProject) =>
      new basicCommands.UpdatePageBackgroundCommand(activePageId, background).execute(
        currentProject,
      ),
    );
  }

  function setPageTransition(transition: SlideTransition) {
    commitProject((currentProject) =>
      new basicCommands.SetPageTransitionCommand(activePageId, transition).execute(currentProject),
    );
  }

  function clearPageTransition() {
    commitProject((currentProject) =>
      new basicCommands.ClearPageTransitionCommand(activePageId).execute(currentProject),
    );
  }

  function setElementAnimationBuilds(elementIds: string[], patch: ElementAnimationPatch) {
    commitProject((currentProject) =>
      new basicCommands.SetElementAnimationBuildsCommand(
        activePageId,
        elementIds,
        (elementId) => createPrefixedId(`animation-${elementId}`),
        patch,
      ).execute(currentProject),
    );
  }

  function clearElementAnimationBuild(elementId: string) {
    commitProject((currentProject) =>
      new basicCommands.ClearElementAnimationBuildCommand(activePageId, elementId).execute(
        currentProject,
      ),
    );
  }

  function reorderElementAnimationBuild(elementId: string, targetIndex: number) {
    commitProject((currentProject) =>
      new basicCommands.ReorderElementAnimationBuildCommand(
        activePageId,
        elementId,
        targetIndex,
      ).execute(currentProject),
    );
  }

  function getTranslatableTextElementIds(
    scope: TranslationScope,
    sourceProject = project,
    options?: { pageId?: string },
  ) {
    const getVisibleUnlockedTextId = (elementId: string) => {
      const element = sourceProject.elements[elementId];
      if (!element || element.type !== 'text' || element.locked || element.visible === false)
        return undefined;
      return element.id;
    };

    if (scope === 'selection') {
      return selectedElementIds
        .map(getVisibleUnlockedTextId)
        .filter((id): id is string => Boolean(id));
    }

    const pages =
      scope === 'slide'
        ? sourceProject.pages.filter((page) => page.id === (options?.pageId ?? activePageId))
        : sourceProject.pages;

    return pages.flatMap((page) =>
      page.elementIds.map(getVisibleUnlockedTextId).filter((id): id is string => Boolean(id)),
    );
  }

  async function translateTextScope(
    scope: TranslationScope,
    targetLanguage = 'pt',
    options?: { pageId?: string; sourceLanguage?: string },
  ) {
    const elementIds = getTranslatableTextElementIds(
      scope,
      project,
      options?.pageId ? { pageId: options.pageId } : undefined,
    );
    if (elementIds.length === 0) return [];

    const translatedEntries = await Promise.all(
      elementIds.map(async (elementId) => {
        const element = project.elements[elementId];
        if (!element || element.type !== 'text') return undefined;
        const translatedText = await services.translatorService.translate(
          element.text,
          targetLanguage,
          options?.sourceLanguage ? { sourceLanguage: options.sourceLanguage } : undefined,
        );
        const page = project.pages.find((item) => item.elementIds.includes(elementId));
        return [
          elementId,
          fitTranslatedTextToOriginalFrame(element, translatedText, page),
        ] as const;
      }),
    );
    const translations = Object.fromEntries(
      translatedEntries.filter((entry): entry is readonly [string, TranslationPatch] =>
        Boolean(entry),
      ),
    );

    commitProject((currentProject) =>
      new basicCommands.TranslateTextElementsCommand(translations).execute(currentProject),
    );
    return Array.from(
      new Set(
        elementIds
          .map((elementId) => project.pages.find((page) => page.elementIds.includes(elementId))?.id)
          .filter((pageId): pageId is string => Boolean(pageId)),
      ),
    );
  }

  function getTranslationSampleText() {
    const activePage = project.pages.find((page) => page.id === activePageId) ?? project.pages[0];
    const activePageText = activePage?.elementIds
      .map((elementId) => project.elements[elementId])
      .find((element) => element?.type === 'text' && element.visible !== false && !element.locked);
    if (activePageText?.type === 'text') return activePageText.text;

    const firstText = Object.values(project.elements).find(
      (element) => element.type === 'text' && element.visible !== false && !element.locked,
    );
    return firstText?.type === 'text' ? firstText.text : '';
  }

  async function setTranslationTargetLanguage(languageCode: string) {
    const nextLanguage = translationLanguageUtils.isSupportedTranslationLanguageCode(languageCode)
      ? languageCode
      : '';
    setTranslationTargetLanguageState(nextLanguage);
    setTranslationTargetAttention(false);
    setTranslationNotice(undefined);
    if (typeof window !== 'undefined') {
      if (nextLanguage) {
        editorPreferences.writeTranslationTargetLanguage(nextLanguage);
      } else {
        editorPreferences.writeTranslationTargetLanguage('');
      }
    }

    if (!nextLanguage) {
      setTranslationPreparation({ progress: 0, status: 'idle' });
      return;
    }

    const sampleText = getTranslationSampleText();
    if (!sampleText) {
      setTranslationPreparation({ progress: 100, status: 'ready' });
      return;
    }

    setTranslationPreparation({ progress: 4, status: 'downloading' });
    try {
      const sourceLanguage = translationLanguageUtils.normalizeLanguageCode(
        await services.translatorService.detectLanguage(sampleText, {
          onProgress: (progress, details) => {
            setTranslationPreparation((current) => ({
              ...getDownloadProgressPatch(
                Math.max(current.progress, 4, Math.min(45, Math.round(progress * 0.45))),
                details,
              ),
              status: 'downloading',
            }));
          },
        }),
      );
      const selectedTranslationProvider = translationProviderStates.find(
        (provider) => provider.selected,
      );
      const shouldPrepareLanguagePair =
        !selectedTranslationProvider?.modelId ||
        selectedTranslationProvider.runtime === 'chrome-built-in';
      if (shouldPrepareLanguagePair) {
        setTranslationPreparation({ progress: 8, sourceLanguage, status: 'downloading' });
        await services.translatorService.prepareTranslation(sourceLanguage, nextLanguage, {
          onProgress: (progress, details) => {
            setTranslationPreparation((current) => ({
              ...getDownloadProgressPatch(
                Math.max(current.progress, 8, Math.min(100, Math.round(progress))),
                details,
              ),
              sourceLanguage,
              status: progress >= 100 ? 'ready' : 'downloading',
            }));
          },
        });
      }
      setTranslationPreparation({ progress: 100, sourceLanguage, status: 'ready' });
    } catch (error) {
      setTranslationPreparation({ progress: 0, status: 'failed' });
      setTranslationNotice(
        error instanceof Error ? error.message : 'Translation language could not be prepared.',
      );
    }
  }

  async function requestTranslation(scope: TranslationScope, options?: { pageId?: string }) {
    if (isTranslating) return;

    if (!translationTargetLanguage) {
      setActiveTab('ai-tools');
      setTranslationTargetAttention(true);
      setTranslationNotice('Choose a target language in AI Tools before translating.');
      return;
    }

    if (translationPreparation.status === 'downloading') {
      setActiveTab('ai-tools');
      setTranslationTargetAttention(true);
      setTranslationNotice('Wait for the translation language pair to finish downloading.');
      return;
    }

    setTranslationNotice(undefined);
    setIsTranslating(true);
    try {
      const translationOptions =
        translationPreparation.sourceLanguage || options?.pageId
          ? {
              ...(options?.pageId ? { pageId: options.pageId } : {}),
              ...(translationPreparation.sourceLanguage
                ? { sourceLanguage: translationPreparation.sourceLanguage }
                : {}),
            }
          : undefined;
      const translatedPageIds = await translateTextScope(
        scope,
        translationTargetLanguage,
        translationOptions,
      );
      if (translatedPageIds.length > 0) {
        const normalizedTargetLanguage =
          translationLanguageUtils.normalizeLanguageCode(translationTargetLanguage);
        setPageLanguageCodes((current) => ({
          ...current,
          ...Object.fromEntries(
            translatedPageIds.map((pageId) => [pageId, normalizedTargetLanguage]),
          ),
        }));
      }
    } catch (error) {
      setTranslationNotice(
        error instanceof Error ? error.message : 'Translation could not be completed.',
      );
    } finally {
      setIsTranslating(false);
    }
  }

  function createProjectForAutomation(input: { name?: string }) {
    const blankProject = sampleProject.createBlankProject();
    const nextProject = normalizeProjectDocument({
      ...blankProject,
      name: input.name?.trim() || blankProject.name,
      updatedAt: new Date().toISOString(),
    });
    replaceProjectForAutomation(nextProject);
    return Promise.resolve(nextProject);
  }

  async function generateSlidesForAutomation(input: { prompt: string }) {
    await generateSlideFromPrompt(input.prompt);
    return projectRef.current;
  }

  async function generateImageForAutomation(input: {
    height?: number;
    prompt: string;
    seed?: number;
    steps?: number;
    width?: number;
  }) {
    const options =
      input.height !== undefined ||
      input.seed !== undefined ||
      input.steps !== undefined ||
      input.width !== undefined
        ? {
            ...createImageOptions,
            ...(input.height !== undefined ? { height: input.height } : {}),
            ...(input.seed !== undefined ? { seed: input.seed } : {}),
            ...(input.steps !== undefined ? { steps: input.steps } : {}),
            ...(input.width !== undefined ? { width: input.width } : {}),
          }
        : undefined;
    await generateImageFromPrompt(input.prompt, options);
    return projectRef.current;
  }

  async function translateTextForAutomation(input: {
    pageId?: string;
    scope: TranslationScope;
    targetLanguage: string;
  }) {
    await setTranslationTargetLanguage(input.targetLanguage);
    const translationOptions = input.pageId ? { pageId: input.pageId } : undefined;
    const translatedPageIds = await translateTextScope(
      input.scope,
      input.targetLanguage,
      translationOptions,
    );
    if (translatedPageIds.length > 0) {
      const normalizedTargetLanguage = translationLanguageUtils.normalizeLanguageCode(
        input.targetLanguage,
      );
      setPageLanguageCodes((current) => ({
        ...current,
        ...Object.fromEntries(
          translatedPageIds.map((pageId) => [pageId, normalizedTargetLanguage]),
        ),
      }));
    }
    return {
      project: projectRef.current,
      translatedPageIds,
    };
  }

  function getAutomationState() {
    return {
      project: projectRef.current,
      selection: {
        pageId: activePageIdRef.current,
        elementIds: selectedElementIdsRef.current,
      },
    };
  }

  const automation: EditorAutomationDelegate = {
    createProject: createProjectForAutomation,
    generateSlides: generateSlidesForAutomation,
    generateImage: generateImageForAutomation,
    translateText: translateTextForAutomation,
    getState: getAutomationState,
  };

  function setElementVisibility(elementId: string, visible: boolean) {
    commitProject((currentProject) =>
      new basicCommands.SetElementVisibilityCommand(elementId, visible).execute(currentProject),
    );
  }

  function setElementLock(elementId: string, locked: boolean) {
    commitProject((currentProject) =>
      new basicCommands.SetElementLockCommand(elementId, locked).execute(currentProject),
    );
  }

  function getSelectedElementsForClipboard() {
    const page = project.pages.find((item) => item.id === activePageId);
    if (!page) return [];
    return page.elementIds
      .filter((elementId) => selectedElementIds.includes(elementId))
      .map((elementId) => project.elements[elementId])
      .filter((element): element is DesignElement => Boolean(element));
  }

  function copySelectedElements() {
    const selectedElements = getSelectedElementsForClipboard();
    if (selectedElements.length === 0) return;
    const copiedAssets: ProjectDocument['assets'] = {};
    for (const element of selectedElements) {
      if (element.type !== 'image' && element.type !== 'gif' && element.type !== 'video') continue;
      const asset = project.assets[element.assetId];
      if (asset) copiedAssets[element.assetId] = asset;
    }
    setElementClipboard({
      assets: copiedAssets,
      elements: selectedElements.map((element) => ({ ...element })),
    });
  }

  function pasteCopiedElements() {
    if (elementClipboard.elements.length === 0) return false;
    const pastedElements = elementClipboard.elements.map((element) => ({
      ...element,
      id: createPrefixedId(`${element.id}-copy`),
      x: element.x + PASTED_ELEMENT_OFFSET,
      y: element.y + PASTED_ELEMENT_OFFSET,
      locked: false,
    }));

    commitProject(
      (currentProject) =>
        new basicCommands.AddElementsCommand(
          activePageId,
          pastedElements,
          elementClipboard.assets,
        ).execute(currentProject),
      { selectedElementIds: pastedElements.map((element) => element.id) },
    );
    setElementClipboard({
      assets: elementClipboard.assets,
      elements: pastedElements.map((element) => ({ ...element })),
    });
    return true;
  }

  function deleteElement(elementId: string) {
    commitProject((currentProject) => {
      const nextProject = new basicCommands.DeleteElementCommand(activePageId, elementId).execute(
        currentProject,
      );
      const nextPage = nextProject.pages.find((page) => page.id === activePageId);
      if (selectedElementIds.includes(elementId)) {
        const nextSelectedId = nextPage?.elementIds.at(-1);
        setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
      }
      return nextProject;
    });
  }

  function removeAsset(assetId: string) {
    commitProject((currentProject) =>
      new basicCommands.RemoveAssetCommand(assetId).execute(currentProject),
    );
  }

  function deleteSelectedElement() {
    const deletableElementIds = selectedElementIds.filter(
      (elementId) => !processingElementIds.includes(elementId),
    );
    if (deletableElementIds.length === 0) return;
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    deletableElementIds.forEach((elementId) => {
      clearBackgroundSelectionPoints(elementId);
    });
    commitProject((currentProject) => {
      const nextProject = deletableElementIds.reduce(
        (nextProjectState, elementId) =>
          new basicCommands.DeleteElementCommand(activePageId, elementId).execute(nextProjectState),
        currentProject,
      );
      const nextPage = nextProject.pages.find((page) => page.id === activePageId);
      const nextSelectedId = nextPage?.elementIds.at(-1);
      setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
      return nextProject;
    });
  }

  function cutSelectedElements() {
    const selectedElements = getSelectedElementsForClipboard();
    if (selectedElements.length === 0) return;
    copySelectedElements();
    deleteSelectedElement();
  }

  function duplicateSelectedElement() {
    const elementId = selectedElementIds[0];
    if (!elementId) return;
    if (processingElementIds.includes(elementId)) return;
    const nextElementId = createPrefixedId(`${elementId}-copy`);
    commitProject(
      (currentProject) =>
        new basicCommands.DuplicateElementCommand(activePageId, elementId, nextElementId).execute(
          currentProject,
        ),
      { selectedElementIds: [nextElementId] },
    );
  }

  function insertTextElement(preset: TextPreset = 'title') {
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;
    const selectedElement = project.elements[selectedElementIds[0] ?? ''];
    const titleTemplate = project.elements['text-title'];
    const subtitleTemplate = project.elements['text-subtitle'];
    const presetStyles: Record<
      TextPreset,
      Omit<
        Extract<DesignElement, { type: 'text' }>,
        'id' | 'locked' | 'opacity' | 'rotation' | 'type' | 'visible' | 'x' | 'y'
      >
    > = {
      title:
        titleTemplate?.type === 'text'
          ? {
              text: 'Add a heading',
              width: titleTemplate.width,
              height: titleTemplate.height,
              fontFamily: titleTemplate.fontFamily,
              fontSize: titleTemplate.fontSize,
              fontWeight: titleTemplate.fontWeight,
              fill: titleTemplate.fill,
              align: titleTemplate.align,
            }
          : {
              text: 'Add a heading',
              width: 680,
              height: 220,
              fontFamily: 'Orbitron',
              fontSize: 96,
              fontWeight: 800,
              fill: '#37FD76',
              align: 'center',
            },
      subtitle:
        subtitleTemplate?.type === 'text'
          ? {
              text: 'Add a subheading',
              width: subtitleTemplate.width,
              height: subtitleTemplate.height,
              fontFamily: subtitleTemplate.fontFamily,
              fontSize: subtitleTemplate.fontSize,
              fontWeight: subtitleTemplate.fontWeight,
              fill: subtitleTemplate.fill,
              align: subtitleTemplate.align,
            }
          : {
              text: 'Add a subheading',
              width: 720,
              height: 92,
              fontFamily: 'Open Sans',
              fontSize: 44,
              fontWeight: 700,
              fill: '#FFFFFF',
              align: 'center',
            },
      body: {
        text: 'Add a little bit of body text',
        width: 760,
        height: 120,
        fontFamily: 'Open Sans',
        fontSize: 32,
        fontWeight: 500,
        fill: '#FFFFFF',
        align: 'left',
      },
    };
    const style = presetStyles[preset];
    const width = style.width;
    const height = style.height;
    const elementId = createPrefixedId('text');
    const nextElement: DesignElement = {
      id: elementId,
      type: 'text',
      text: style.text,
      x: selectedElement
        ? Math.min(page.width - width, selectedElement.x + PASTED_ELEMENT_OFFSET)
        : (page.width - width) / 2,
      y: selectedElement
        ? Math.min(page.height - height, selectedElement.y + PASTED_ELEMENT_OFFSET)
        : (page.height - height) / 2,
      width,
      height,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fill: style.fill,
      align: style.align,
    };

    commitProject(
      (currentProject) =>
        new basicCommands.AddElementsCommand(activePageId, [nextElement]).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
  }

  function insertShapeElement(shape: ShapeKind) {
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;
    const selectedElement = project.elements[selectedElementIds[0] ?? ''];
    const isLinearShape = shape === 'line' || shape === 'arc';
    const defaultFrame: Record<ShapeKind, { width: number; height: number }> = {
      arc: { width: 260, height: 180 },
      arrow: { width: 260, height: 140 },
      diamond: { width: 180, height: 180 },
      ellipse: { width: 180, height: 180 },
      line: { width: 260, height: 120 },
      parallelogram: { width: 240, height: 150 },
      pentagon: { width: 190, height: 190 },
      rect: { width: 180, height: 180 },
      'rounded-rect': { width: 240, height: 150 },
      triangle: { width: 190, height: 180 },
    };
    const { width, height } = defaultFrame[shape];
    const elementId = createPrefixedId('shape');
    const nextElement: ShapeElement = {
      id: elementId,
      type: 'shape',
      shape,
      x: selectedElement
        ? Math.min(page.width - width, selectedElement.x + PASTED_ELEMENT_OFFSET)
        : (page.width - width) / 2,
      y: selectedElement
        ? Math.min(page.height - height, selectedElement.y + PASTED_ELEMENT_OFFSET)
        : (page.height - height) / 2,
      width,
      height,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      ...(isLinearShape ? { stroke: '#37FD76', strokeWidth: 4 } : { fill: '#37FD76' }),
    };

    commitProject(
      (currentProject) =>
        new basicCommands.AddElementsCommand(activePageId, [nextElement]).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
    setActiveTab('design');
  }

  function alignSelectedElement(mode: AlignMode) {
    const elementId = selectedElementIds[0];
    if (!elementId) return;
    commitProject((currentProject) =>
      new basicCommands.AlignElementCommand(activePageId, elementId, mode).execute(currentProject),
    );
  }

  function setSelectedElementZOrder(mode: ZOrderMode) {
    const elementId = selectedElementIds[0];
    if (!elementId) return;
    commitProject((currentProject) =>
      new basicCommands.SetZOrderCommand(activePageId, elementId, mode).execute(currentProject),
    );
  }

  function flipSelectedImage() {
    const elementId = selectedElementIds[0];
    if (!elementId || selectedElementIds.length !== 1) return;
    commitProject((currentProject) =>
      new basicCommands.ToggleImageFlipCommand(elementId).execute(currentProject),
    );
  }

  function updateImageCrop(elementId: string, patch: ImageCropPatch) {
    commitProject((currentProject) =>
      new basicCommands.UpdateImageCropCommand(elementId, patch).execute(currentProject),
    );
  }

  function reorderElement(
    elementId: string,
    targetElementId: string,
    position: 'before' | 'after' = 'before',
  ) {
    commitProject((currentProject) => {
      const page = currentProject.pages.find((item) => item.id === activePageId);
      if (!page) return currentProject;

      const displayOrder = [...page.elementIds].reverse().filter((id) => id !== elementId);
      const targetDisplayIndex = displayOrder.indexOf(targetElementId);
      if (targetDisplayIndex < 0) return currentProject;
      displayOrder.splice(
        position === 'after' ? targetDisplayIndex + 1 : targetDisplayIndex,
        0,
        elementId,
      );
      const nextPageOrder = [...displayOrder].reverse();
      const targetPageIndex = nextPageOrder.indexOf(elementId);
      return new basicCommands.ReorderElementCommand(
        activePageId,
        elementId,
        targetPageIndex,
      ).execute(currentProject);
    });
  }

  function addPage(afterPageId = activePageId) {
    const sourcePage =
      project.pages.find((item) => item.id === afterPageId) ??
      project.pages.find((item) => item.id === activePageId) ??
      project.pages[0];
    if (!sourcePage) return;
    const pageId = createPrefixedId('page');
    const nextPage: Page = {
      id: pageId,
      name: `Slide ${project.pages.length + 1}`,
      width: sourcePage.width,
      height: sourcePage.height,
      background: sourcePage.background,
      elementIds: [],
    };

    commitProject(
      (currentProject) => {
        const afterIndex = currentProject.pages.findIndex((page) => page.id === afterPageId);
        const insertIndex = afterIndex >= 0 ? afterIndex + 1 : currentProject.pages.length;
        const pages = [...currentProject.pages];
        pages.splice(insertIndex, 0, nextPage);
        return {
          ...currentProject,
          pages,
          updatedAt: new Date().toISOString(),
        };
      },
      { activePageId: pageId, selectedElementIds: [] },
    );
  }

  function duplicatePage(pageId: string) {
    const page = project.pages.find((item) => item.id === pageId);
    if (!page) return;
    const nextPageId = createPrefixedId('page');
    commitProject(
      (currentProject) =>
        new basicCommands.DuplicatePageCommand(pageId, nextPageId, (elementId) =>
          createPrefixedId(`${elementId}-page`),
        ).execute(currentProject),
      { activePageId: nextPageId, selectedElementIds: [] },
    );
  }

  function deletePage(pageId: string) {
    if (project.pages.length <= 1) return;
    const pageIndex = project.pages.findIndex((page) => page.id === pageId);
    if (pageIndex < 0) return;
    const nextPageId =
      project.pages[pageIndex + 1]?.id ??
      project.pages[pageIndex - 1]?.id ??
      project.pages[0]?.id ??
      '';
    commitProject(
      (currentProject) => new basicCommands.DeletePageCommand(pageId).execute(currentProject),
      {
        activePageId: nextPageId,
        selectedElementIds: [],
      },
    );
  }

  function reorderPage(pageId: string, targetIndex: number) {
    commitProject(
      (currentProject) =>
        new basicCommands.ReorderPageCommand(pageId, targetIndex).execute(currentProject),
      {
        activePageId: pageId,
      },
    );
  }

  function renamePage(pageId: string, name: string) {
    commitProject((currentProject) =>
      new basicCommands.RenamePageCommand(pageId, name).execute(currentProject),
    );
  }

  function setPageVisibility(pageId: string, visible: boolean) {
    commitProject((currentProject) =>
      new basicCommands.SetPageVisibilityCommand(pageId, visible).execute(currentProject),
    );
  }

  function activateScrolledPage(pageId: string) {
    if (pageId === activePageId) return;
    const page = project.pages.find((item) => item.id === pageId);
    if (!page) return;
    setActivePageId(page.id);
    setSelectedElementIds([]);
  }

  function togglePagesPanel() {
    setPagesPanelOpen((current) => !current);
  }

  async function toggleFullscreen(target?: HTMLElement | null) {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await (target ?? document.documentElement).requestFullscreen();
    } catch {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
  }

  function undo() {
    const previousProject = history.past.at(-1);
    if (!previousProject) return;

    setHistory((currentHistory) => ({
      past: currentHistory.past.slice(0, -1),
      future: [project, ...currentHistory.future],
    }));
    setProject(previousProject);
    const nextActivePageId = previousProject.pages.some((page) => page.id === activePageId)
      ? activePageId
      : (previousProject.pages[0]?.id ?? '');
    setActivePageId(nextActivePageId);
    setSelectedElementIds(
      getSelectionForProject(previousProject, nextActivePageId, selectedElementIds),
    );
  }

  function redo() {
    const nextProject = history.future[0];
    if (!nextProject) return;

    setHistory((currentHistory) => ({
      past: [...currentHistory.past, project],
      future: currentHistory.future.slice(1),
    }));
    setProject(nextProject);
    const nextActivePageId = nextProject.pages.some((page) => page.id === activePageId)
      ? activePageId
      : (nextProject.pages[0]?.id ?? '');
    setActivePageId(nextActivePageId);
    setSelectedElementIds(
      getSelectionForProject(nextProject, nextActivePageId, selectedElementIds),
    );
  }

  function zoomIn() {
    setZoomPercent((current) => Math.min(200, current + 10));
  }

  function zoomOut() {
    setZoomPercent((current) => Math.max(50, current - 10));
  }

  function resetZoom() {
    setZoomPercent(100);
  }

  function toggleBackgroundSelectionMode() {
    const element = project.elements[selectedElementIds[0] ?? ''];
    if (element?.type !== 'image') return;
    if (processingElementIds.includes(element.id)) return;
    if (backgroundSelectionMode) {
      setBackgroundSelectionMode(false);
      setBackgroundSelectionNotice(undefined);
      clearBackgroundPreview();
      clearBackgroundPreparation();
      clearBackgroundSelectionPoints(element.id);
      return;
    }

    const imageEditingModel = modelStates.find(
      (state) => state.id === modelSetupService.IMAGE_EDITING_MODEL_ID,
    );
    if (imageEditingModel?.status !== 'ready') {
      setActiveTab('ai-tools');
      setBackgroundSelectionNotice(IMAGE_EDITING_MODEL_REQUIRED_MESSAGE);
      return;
    }

    setBackgroundSelectionNotice(undefined);
    setBackgroundSelectionMode(true);
    clearBackgroundSelectionPoints(element.id);
    prepareBackgroundSelection(element.id);
  }

  function cancelBackgroundSelectionMode() {
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints();
  }

  function prepareBackgroundSelection(elementId: string) {
    const element = project.elements[elementId];
    if (!element || element.type !== 'image') return;
    const asset = project.assets[element.assetId];
    if (!asset) return;

    const sequence = backgroundPreparationSequenceRef.current + 1;
    backgroundPreparationSequenceRef.current = sequence;
    setBackgroundPreparation({ elementId, progress: 4, status: 'preparing' });

    void (async () => {
      try {
        await services.backgroundRemovalService.prepareBackgroundRemoval(asset, {
          onProgress: (progress) => {
            if (backgroundPreparationSequenceRef.current !== sequence) return;
            setBackgroundPreparation({
              elementId,
              progress: Math.max(4, Math.min(100, Math.round(progress))),
              status: progress >= 100 ? 'ready' : 'preparing',
            });
          },
        });
        if (backgroundPreparationSequenceRef.current !== sequence) return;
        setBackgroundPreparation({ elementId, progress: 100, status: 'ready' });
      } catch {
        if (backgroundPreparationSequenceRef.current !== sequence) return;
        setBackgroundPreparation({ elementId, progress: 0, status: 'failed' });
      }
    })();
  }

  function getBackgroundSelectionPointSet(
    elementId: string,
    point: { x: number; y: number },
    positive: boolean,
  ) {
    return [...(backgroundSelectionPointsRef.current[elementId] ?? []), { ...point, positive }];
  }

  function setBackgroundSelectionPointSet(elementId: string, points: BackgroundSelectionPoint[]) {
    backgroundSelectionPointsRef.current = {
      ...backgroundSelectionPointsRef.current,
      [elementId]: points,
    };
    setBackgroundSelectionPoints(backgroundSelectionPointsRef.current);
  }

  function previewBackgroundSubject(elementId: string, subjectPoint: { x: number; y: number }) {
    if (!backgroundSelectionMode || processingElementIds.includes(elementId)) return;
    if (!isBackgroundPreparationReady(elementId)) return;
    const element = project.elements[elementId];
    if (!element || element.type !== 'image') return;
    const asset = project.assets[element.assetId];
    if (!asset) return;

    const sequence = backgroundPreviewSequenceRef.current + 1;
    backgroundPreviewSequenceRef.current = sequence;
    if (backgroundPreviewTimeoutRef.current !== undefined) {
      window.clearTimeout(backgroundPreviewTimeoutRef.current);
    }
    const points = getBackgroundSelectionPointSet(elementId, subjectPoint, true);
    setBackgroundPreview((currentPreview) => {
      const shouldKeepCurrentPreview = currentPreview?.elementId === elementId;
      return {
        elementId,
        pending: true,
        ...(shouldKeepCurrentPreview && currentPreview.maskUrl
          ? { maskUrl: currentPreview.maskUrl }
          : {}),
        ...(shouldKeepCurrentPreview && currentPreview.score !== undefined
          ? { score: currentPreview.score }
          : {}),
      };
    });

    backgroundPreviewTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await services.backgroundRemovalService.previewBackgroundMask(asset, {
            points,
          });
          if (backgroundPreviewSequenceRef.current !== sequence) return;
          setBackgroundPreview({
            elementId,
            maskUrl: result.maskUrl,
            pending: false,
            score: result.score,
          });
        } catch {
          if (backgroundPreviewSequenceRef.current !== sequence) return;
          setBackgroundPreview((currentPreview) =>
            currentPreview?.elementId === elementId
              ? { ...currentPreview, pending: false }
              : currentPreview,
          );
        }
      })();
    }, BACKGROUND_PREVIEW_DEBOUNCE_MS);
  }

  function refineBackgroundSubject(elementId: string, subjectPoint: { x: number; y: number }) {
    if (!backgroundSelectionMode || processingElementIds.includes(elementId)) return;
    if (!isBackgroundPreparationReady(elementId)) return;
    const element = project.elements[elementId];
    if (!element || element.type !== 'image') return;
    const asset = project.assets[element.assetId];
    if (!asset) return;
    const points = getBackgroundSelectionPointSet(elementId, subjectPoint, true);
    setBackgroundSelectionPointSet(elementId, points);
    const sequence = backgroundPreviewSequenceRef.current + 1;
    backgroundPreviewSequenceRef.current = sequence;
    if (backgroundPreviewTimeoutRef.current !== undefined) {
      window.clearTimeout(backgroundPreviewTimeoutRef.current);
      backgroundPreviewTimeoutRef.current = undefined;
    }
    setBackgroundPreview((currentPreview) => {
      const shouldKeepCurrentPreview = currentPreview?.elementId === elementId;
      return {
        elementId,
        pending: true,
        ...(shouldKeepCurrentPreview && currentPreview.maskUrl
          ? { maskUrl: currentPreview.maskUrl }
          : {}),
        ...(shouldKeepCurrentPreview && currentPreview.score !== undefined
          ? { score: currentPreview.score }
          : {}),
      };
    });

    void (async () => {
      try {
        const result = await services.backgroundRemovalService.previewBackgroundMask(asset, {
          points,
        });
        if (backgroundPreviewSequenceRef.current !== sequence) return;
        setBackgroundPreview({
          elementId,
          maskUrl: result.maskUrl,
          pending: false,
          score: result.score,
        });
      } catch {
        if (backgroundPreviewSequenceRef.current !== sequence) return;
        setBackgroundPreview({ elementId, pending: false });
      }
    })();
  }

  async function pickBackgroundSubject(elementId: string, subjectPoint: { x: number; y: number }) {
    if (processingElementIds.includes(elementId)) return;
    if (!isBackgroundPreparationReady(elementId)) return;
    const element = project.elements[elementId];
    if (!element || element.type !== 'image') return;
    const asset = project.assets[element.assetId];
    if (!asset) return;

    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    const points = getBackgroundSelectionPointSet(elementId, subjectPoint, true);
    clearBackgroundSelectionPoints(elementId);
    setProcessingElementIds((currentIds) =>
      currentIds.includes(elementId) ? currentIds : [...currentIds, elementId],
    );
    await waitForNextPaint();

    try {
      const result = await services.backgroundRemovalService.removeBackground(asset, { points });
      commitProject(
        (currentProject) => ({
          ...currentProject,
          assets: {
            ...currentProject.assets,
            [result.asset.id]: result.asset,
          },
          elements: {
            ...currentProject.elements,
            [elementId]: {
              ...element,
              assetId: result.asset.id,
              ...(result.bounds
                ? {
                    x: element.x + element.width * result.bounds.x,
                    y: element.y + element.height * result.bounds.y,
                    width: Math.max(1, element.width * result.bounds.width),
                    height: Math.max(1, element.height * result.bounds.height),
                  }
                : {}),
            },
          },
          updatedAt: new Date().toISOString(),
        }),
        { selectedElementIds: [elementId] },
      );
    } finally {
      setProcessingElementIds((currentIds) => currentIds.filter((id) => id !== elementId));
    }
  }

  async function importImageFile(file: File) {
    const dataUrl = await readImageFileAsDataUrl(file);
    const assetType = getMediaAssetType(file);
    const mediaSize =
      assetType === 'video' ? await readVideoSize(dataUrl) : await readImageSize(dataUrl);
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    const assetId = createPrefixedId('asset');
    const elementId = createPrefixedId(assetType);
    const mediaName =
      file.name.trim() ||
      (assetType === 'video'
        ? 'Pasted video'
        : assetType === 'gif'
          ? 'Pasted GIF'
          : 'Pasted image');
    const fittedMedia = fitImageWithinPage({
      imageWidth: mediaSize.width,
      imageHeight: mediaSize.height,
      pageWidth: page.width,
      pageHeight: page.height,
    });

    if (assetType === 'gif') {
      commitProject(
        (currentProject) =>
          new basicCommands.AddMediaElementCommand(activePageId, {
            asset: {
              id: assetId,
              type: 'gif',
              name: mediaName,
              mimeType: file.type || 'image/gif',
              objectUrl: dataUrl,
            },
            element: {
              id: elementId,
              type: 'gif',
              assetId,
              x: fittedMedia.x,
              y: fittedMedia.y,
              width: fittedMedia.width,
              height: fittedMedia.height,
              rotation: 0,
              locked: false,
              visible: true,
              opacity: 1,
              playing: true,
            },
          }).execute(currentProject),
        { selectedElementIds: [elementId] },
      );
      return;
    }

    if (assetType === 'video') {
      commitProject(
        (currentProject) =>
          new basicCommands.AddMediaElementCommand(activePageId, {
            asset: {
              id: assetId,
              type: 'video',
              name: mediaName,
              mimeType: file.type || 'video/mp4',
              objectUrl: dataUrl,
            },
            element: {
              id: elementId,
              type: 'video',
              assetId,
              x: fittedMedia.x,
              y: fittedMedia.y,
              width: fittedMedia.width,
              height: fittedMedia.height,
              rotation: 0,
              locked: false,
              visible: true,
              opacity: 1,
              loop: false,
              controls: true,
              muted: true,
              autoplayInPreview: true,
              trimStartSeconds: 0,
            },
          }).execute(currentProject),
        { selectedElementIds: [elementId] },
      );
      return;
    }

    commitProject(
      (currentProject) =>
        new basicCommands.AddImageElementCommand(activePageId, {
          asset: {
            id: assetId,
            type: 'image',
            name: mediaName,
            mimeType: file.type || 'image/*',
            objectUrl: dataUrl,
          },
          element: {
            id: elementId,
            type: 'image',
            assetId,
            x: fittedMedia.x,
            y: fittedMedia.y,
            width: fittedMedia.width,
            height: fittedMedia.height,
            rotation: 0,
            locked: false,
            visible: true,
            opacity: 1,
          },
        }).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
  }

  function addRecentStockMedia(item: StockMediaItem) {
    setStockMediaRecentItems((currentItems) => [
      item,
      ...currentItems.filter(
        (currentItem) => currentItem.provider !== item.provider || currentItem.id !== item.id,
      ),
    ].slice(0, STOCK_MEDIA_RECENT_LIMIT));
  }

  async function searchStockImages(query: string) {
    setStockMediaSearching((current) => ({ ...current, images: true }));
    setStockMediaError((current) => ({ ...current, images: undefined }));
    try {
      const results = await services.stockMediaService.searchImages(query);
      setStockImageResults(results);
      setStockMediaError((current) => ({ ...current, images: undefined }));
    } catch {
      setStockImageResults([]);
      setStockMediaError((current) => ({
        ...current,
        images: 'API Key is invalid',
      }));
    } finally {
      setStockMediaSearching((current) => ({ ...current, images: false }));
    }
  }

  async function searchStockGifs(query: string) {
    setStockMediaSearching((current) => ({ ...current, gifs: true }));
    setStockMediaError((current) => ({ ...current, gifs: undefined }));
    try {
      const results = await services.stockMediaService.searchGifs(query);
      setStockGifResults(results);
      setStockMediaError((current) => ({ ...current, gifs: undefined }));
    } catch {
      setStockGifResults([]);
      setStockMediaError((current) => ({
        ...current,
        gifs: 'API Key is invalid',
      }));
    } finally {
      setStockMediaSearching((current) => ({ ...current, gifs: false }));
    }
  }

  async function insertRemoteImage(item: StockMediaItem) {
    if (item.kind !== 'image') return;
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;
    await services.stockMediaService.trackImageDownload(item).catch(() => undefined);

    const assetId = createPrefixedId('asset');
    const elementId = createPrefixedId('image');
    const fittedMedia = fitImageWithinPage({
      imageWidth: item.width,
      imageHeight: item.height,
      pageWidth: page.width,
      pageHeight: page.height,
    });

    commitProject(
      (currentProject) =>
        new basicCommands.AddImageElementCommand(activePageId, {
          asset: {
            id: assetId,
            type: 'image',
            name: item.title,
            mimeType: 'image/jpeg',
            objectUrl: item.mediaUrl,
            storage: 'remote',
          },
          element: {
            id: elementId,
            type: 'image',
            assetId,
            x: fittedMedia.x,
            y: fittedMedia.y,
            width: fittedMedia.width,
            height: fittedMedia.height,
            rotation: 0,
            locked: false,
            visible: true,
            opacity: 1,
          },
        }).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
    addRecentStockMedia(item);
  }

  function insertRemoteGif(item: StockMediaItem) {
    if (item.kind !== 'gif') return;
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    const assetId = createPrefixedId('asset');
    const elementId = createPrefixedId('gif');
    const fittedMedia = fitImageWithinPage({
      imageWidth: item.width,
      imageHeight: item.height,
      pageWidth: page.width,
      pageHeight: page.height,
    });

    commitProject(
      (currentProject) =>
        new basicCommands.AddMediaElementCommand(activePageId, {
          asset: {
            id: assetId,
            type: 'gif',
            name: item.title,
            mimeType: 'image/gif',
            objectUrl: item.mediaUrl,
            storage: 'remote',
          },
          element: {
            id: elementId,
            type: 'gif',
            assetId,
            x: fittedMedia.x,
            y: fittedMedia.y,
            width: fittedMedia.width,
            height: fittedMedia.height,
            rotation: 0,
            locked: false,
            visible: true,
            opacity: 1,
            playing: true,
          },
        }).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
    addRecentStockMedia(item);
  }

  function insertStockMedia(item: StockMediaItem) {
    if (item.kind === 'gif') {
      insertRemoteGif(item);
      return;
    }
    void insertRemoteImage(item);
  }

  function updateMediaPlayback(elementId: string, patch: MediaPlaybackPatch) {
    commitProject((currentProject) =>
      new basicCommands.UpdateMediaPlaybackCommand(elementId, patch).execute(currentProject),
    );
  }

  return {
    project: previewProject ?? project,
    automation,
    activePageId,
    zoomPercent,
    pagesPanelOpen,
    isFullscreen,
    persistenceEnabled,
    presentationImportProgress,
    persistenceAttention,
    persistenceNotice,
    mirrorState,
    mirrorDisabledBySettings,
    mirrorConfig,
    settingsOpen,
    mirrorSettingsOpen,
    mediaSettingsOpen,
    stockMediaConfig,
    stockMediaProviderState,
    stockImageResults,
    stockGifResults,
    stockMediaRecentItems,
    stockMediaSearching,
    stockMediaError,
    localProjectSetupOpen,
    remoteImportOpen,
    remoteImportStatus,
    remoteImportProjects,
    remoteImportError,
    versionHistoryOpen,
    versionHistoryEntries,
    selectedVersionId,
    highlightVersionChanges,
    lastEditedAt,
    saveAnimationKey,
    isVersionPreview: Boolean(previewProject),
    backgroundSelectionMode,
    backgroundSelectionNotice,
    processingElementIds,
    backgroundPreview,
    backgroundPreparation,
    animationPreview,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    selection,
    activeTab,
    activeSlideLanguage,
    setActiveTab,
    modelStates,
    setProjectName,
    setPersistence,
    saveLocalNow,
    saveLocalAs,
    closeLocalProjectSetup,
    confirmLocalProjectSetup,
    openSettings,
    closeSettings,
    openMediaSettings,
    closeMediaSettings,
    openMirrorSettings,
    closeMirrorSettings,
    saveStockMediaConfig,
    clearStockMediaConfig,
    searchStockImages,
    searchStockGifs,
    insertStockMedia,
    saveMirrorConfig,
    testMirrorConnection,
    syncMirrorNow,
    requestMirrorNow,
    setMirrorEnabled,
    setMirrorEnabledFromSettings,
    importRemoteMirror,
    importRemoteMirrorProject,
    deleteRemoteMirrorProject,
    closeRemoteImport,
    importProject,
    importPowerPoint,
    openVersionHistory,
    closeVersionHistory,
    selectVersion,
    restoreVersion,
    setHighlightVersionChanges,
    translationLanguageOptions: TRANSLATION_LANGUAGE_OPTIONS,
    translationTargetLanguage,
    promptProviderStates,
    translationProviderStates,
    languageDetectionProviderStates,
    translationTargetAttention,
    translationPreparation,
    languageDetectionPreparation,
    isTranslating,
    translationNotice,
    promptPreparation,
    promptApiAttention,
    promptApiNotice,
    promptGenerationNotice,
    promptGenerationStatus,
    createImageNotice,
    createImageStatus,
    createImageOptions,
    selectedImagePromptElementId: selectedImageElement?.id,
    isGeneratingImage,
    isGeneratingSlide,
    aiToolsAttentionModelId,
    preparePromptApi,
    prepareSelectedTranslationProvider,
    prepareSelectedLanguageDetectionProvider,
    ensurePromptApiReadyForPrompt,
    ensureImageGenerationReadyForPrompt,
    generateSlideFromPrompt,
    generateImageFromPrompt,
    stopPromptGeneration,
    setCreateImageOptions,
    setPromptProvider,
    setTranslationProvider,
    setLanguageDetectionProvider,
    setTranslationTargetLanguage,
    canTranslateSelection: !isTranslating && getTranslatableTextElementIds('selection').length > 0,
    canTranslateCurrentSlide: !isTranslating && getTranslatableTextElementIds('slide').length > 0,
    canTranslateDeck: !isTranslating && getTranslatableTextElementIds('deck').length > 0,
    canPasteElements: elementClipboard.elements.length > 0,
    translateSelectedText: () => requestTranslation('selection'),
    translateCurrentSlide: () => requestTranslation('slide'),
    translatePage: (pageId: string) => requestTranslation('slide', { pageId }),
    translateDeck: () => requestTranslation('deck'),
    downloadRequiredModels,
    downloadModel,
    removeModel,
    selectElement,
    selectAllElementsOnActivePage,
    clearSelection,
    selectPage,
    activateScrolledPage,
    addPage,
    duplicatePage,
    deletePage,
    reorderPage,
    renamePage,
    setPageVisibility,
    togglePagesPanel,
    toggleFullscreen,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleBackgroundSelectionMode,
    cancelBackgroundSelectionMode,
    previewBackgroundSubject,
    refineBackgroundSubject,
    pickBackgroundSubject,
    deleteSelectedElement,
    duplicateSelectedElement,
    copySelectedElements,
    cutSelectedElements,
    pasteCopiedElements,
    insertTextElement,
    insertShapeElement,
    alignSelectedElement,
    setSelectedElementZOrder,
    flipSelectedImage,
    updateImageCrop,
    updateElementFrame,
    updateElementFrames,
    updateElementStyle,
    updateMediaPlayback,
    updatePageBackground,
    clearPageTransition,
    setPageTransition,
    setElementAnimationBuilds,
    clearElementAnimationBuild,
    reorderElementAnimationBuild,
    playAnimationPreview,
    playPresentationPreview,
    advanceAnimationPreview,
    advancePresentationPreview,
    rewindPresentationPreview,
    updateTextContent,
    setElementVisibility,
    setElementLock,
    deleteElement,
    reorderElement,
    removeAsset,
    importImageFile,
    importMediaFile: importImageFile,
  };
}
