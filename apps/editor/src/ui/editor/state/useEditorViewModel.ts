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
  ImageElement,
  PageBackground,
  ProjectDocument,
  SelectionState,
  ShapeKind,
  SlideTransition,
  TranscriptRecording,
} from '../../../domain/documents/model';
import { sampleProject } from '../../../domain/projects/sampleProject';
import type { EditorAutomationDelegate } from '../../../services/automation/editorAutomationController';
import type {
  AiProviderState,
  FontCatalogItem,
  LocalFontMirrorProgress,
  MirrorProjectSummary,
  MirrorState,
  MirrorSyncProgress,
  ModelDownloadProgressDetails,
  ModelState,
  PromptApiAvailability,
  VersionHistoryEntry,
} from '../../../services/contracts/interfaces';
import type { PptxImportInput } from '../../../services/importing/pptx/pptxImportService';
import { pptxFontRequests } from '../../../services/importing/pptx/pptxFontRequests';
import { pptxImportLogger } from '../../../services/importing/pptx/pptxImportLogger';
import { minioMirrorService } from '../../../services/mirror/minioMirrorService';
import type { MinioMirrorConfig } from '../../../services/mirror/minioMirrorService';
import { aiModelCatalog } from '../../../services/model-setup/aiModelCatalog';
import { imageGenerationModel } from '../../../services/image-generation/imageGenerationModel';
import { createPrefixedId } from '../../../services/ids/idUtils';
import { slideTaskPrompt } from '../../../services/prompting/slideTaskPrompt';
import { imagePromptOptions } from '../media/imagePromptOptions';
import type { CreateImagePromptOptions } from '../media/imagePromptOptions';
import { TRANSLATION_LANGUAGE_OPTIONS } from '../translation/translationLanguages';
import { translationLanguageUtils } from '../translation/translationLanguageUtils';
import { editorPreferences } from '../persistence/editorPreferences';
import { useAnimationPreviewController } from '../animation/useAnimationPreviewController';
import { useLocalMediaImport } from './use-local-media-import';
import { useBackgroundSubjectSelection } from './use-background-subject-selection';
import { powerPointIo } from './power-point-io';
import { textTranslationLayout } from './text-translation-layout';
import type { TranslationPatch } from './text-translation-layout';
import { useOperationNotice } from './use-operation-notice';
import { useStockMediaLibrary } from './use-stock-media-library';
import { editorViewModelProgress } from './editorViewModelProgress';
import { editorViewModelProject } from './editorViewModelProject';
import { editorViewModelRuntime } from './editorViewModelRuntime';
import { editorViewModelElements } from './editorViewModelElements';
import type { ElementClipboardState } from './editorViewModelElements';
import { editorViewModelHistory } from './editorViewModelHistory';
import type { EditorHistory } from './editorViewModelHistory';
import { editorViewModelPages } from './editorViewModelPages';
import { editorViewModelSelection } from './editorViewModelSelection';
import { editorViewModelText } from './editorViewModelText';

export type RightPanelTab =
  | 'layout'
  | 'text'
  | 'elements'
  | 'design'
  | 'ai-tools'
  | 'assets'
  | 'animations';
export type TextPreset = 'title' | 'subtitle' | 'body';
export type { OperationNoticeState } from './use-operation-notice';

export interface MissingPowerPointFont {
  family: string;
  fontWeights: number[];
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
  stage:
    | 'reading'
    | 'inspecting'
    | 'extracting-objects'
    | 'downloading-fonts'
    | 'extracting-media'
    | 'mapping-animations'
    | 'opening';
  title: string;
}

export type RemoteImportStatus =
  | 'loading'
  | 'ready'
  | 'empty'
  | 'importing'
  | 'deleting'
  | 'failed';

const PROMPT_API_REQUIRED_MESSAGE = 'LLM model must be prepared before using prompt-to-slides.';
const IMAGE_GENERATION_MODEL_REQUIRED_MESSAGE =
  'Download image generation models before creating images.';
const IMAGE_PROMPT_MODE_REQUIRED_MESSAGE = 'Use Create image from the + menu to generate images.';
const AUTOSAVE_RETRY_LIMIT = 5;
const AUTOSAVE_RETRY_DELAY_MS = 1000;
type TranslationScope = 'selection' | 'slide' | 'deck';

const DECK_TRANSLATION_CONCURRENCY = 3;

function getFirstFontFamily(fontFamily: string) {
  return fontFamily
    .split(',')
    .at(0)
    ?.replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMissingPowerPointFonts(project: ProjectDocument, missingFamilies: string[]) {
  const missingFamilySet = new Set(missingFamilies.map((family) => family.toLowerCase()));
  const fonts = new Map<string, MissingPowerPointFont>();
  for (const element of Object.values(project.elements)) {
    if (element.type !== 'text') continue;
    const family = getFirstFontFamily(element.fontFamily);
    if (!family || !missingFamilySet.has(family.toLowerCase())) continue;
    const current = fonts.get(family.toLowerCase()) ?? { family, fontWeights: [] };
    const fontWeight = element.fontWeight >= 700 ? 700 : 400;
    if (!current.fontWeights.includes(fontWeight)) {
      current.fontWeights = [...current.fontWeights, fontWeight].sort((a, b) => a - b);
    }
    fonts.set(family.toLowerCase(), current);
  }
  return Array.from(fonts.values()).sort((a, b) => a.family.localeCompare(b.family));
}

interface DeckTranslationProgressState {
  activePageIds: string[];
  completedPages: number;
  currentPageName: string;
  totalPages: number;
}

export function useEditorViewModel(services: AppServices) {
  const initialProject = useMemo(
    () => editorViewModelProject.normalizeProjectDocument(services.initialProject),
    [services.initialProject],
  );
  const storedMirrorConfig = useMemo(
    () => services.mirrorService.loadConfig(),
    [services.mirrorService],
  );
  const storedMirrorPreference = useMemo(() => editorPreferences.readMirrorPreference(), []);
  const shouldEnableStoredMirror = storedMirrorPreference ?? Boolean(storedMirrorConfig);
  const shouldRestoreStoredProject = useMemo(
    () =>
      !services.skipStoredProjectLoad &&
      (editorPreferences.readPersistencePreference() ||
        (Boolean(storedMirrorConfig) && shouldEnableStoredMirror)),
    [services.skipStoredProjectLoad, shouldEnableStoredMirror, storedMirrorConfig],
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
  const [missingPowerPointFonts, setMissingPowerPointFonts] = useState<MissingPowerPointFont[]>(
    [],
  );
  const [hasPersistedLocalProject, setHasPersistedLocalProject] = useState(false);
  const hasPersistedLocalProjectRef = useRef(hasPersistedLocalProject);
  const [activePageId, setActivePageId] = useState(initialProject.pages[0]?.id ?? '');
  const [activePageFocusKey, setActivePageFocusKey] = useState(0);
  const activePageIdRef = useRef(activePageId);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const selectedElementIdsRef = useRef(selectedElementIds);
  const [selectionTarget, setSelectionTarget] = useState<NonNullable<SelectionState['target']>>(
    'presentation',
  );
  const [history, setHistory] = useState<EditorHistory>({ past: [], future: [] });
  const [zoomPercent, setZoomPercent] = useState(100);
  const [pagesPanelOpen, setPagesPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [processingElementIds, setProcessingElementIds] = useState<string[]>([]);
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
  const modelDownloadRunIdsRef = useRef<Record<string, number>>({});
  const promptPreparationRunIdRef = useRef(0);
  const promptGenerationRunIdRef = useRef(0);
  const [elementClipboard, setElementClipboard] = useState<ElementClipboardState>({
    assets: {},
    elements: [],
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [deckTranslationProgress, setDeckTranslationProgress] =
    useState<DeckTranslationProgressState | undefined>();
  const [translationNotice, setTranslationNotice] = useState<string | undefined>();
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [versionHistoryEntries, setVersionHistoryEntries] = useState<VersionHistoryEntry[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>();
  const [previewProject, setPreviewProject] = useState<ProjectDocument | undefined>();
  const [highlightVersionChanges, setHighlightVersionChanges] = useState(true);
  const [lastEditedAt, setLastEditedAt] = useState<string | undefined>(initialProject.updatedAt);
  const [saveAnimationKey, setSaveAnimationKey] = useState(0);
  const [mirrorState, setMirrorState] = useState<MirrorState>(() => ({
    enabled: Boolean(storedMirrorConfig) && shouldEnableStoredMirror,
    status: storedMirrorConfig && shouldEnableStoredMirror ? 'idle' : 'disabled',
  }));
  const [mirrorSyncProgress, setMirrorSyncProgress] = useState<MirrorSyncProgress | undefined>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mirrorSettingsOpen, setMirrorSettingsOpen] = useState(false);
  const [localFontMirrorSettings, setLocalFontMirrorSettings] = useState(() =>
    services.localFontMirrorService.getSettings(),
  );
  const [localFontOptions, setLocalFontOptions] = useState<FontCatalogItem[]>([]);
  const [mediaSettingsOpen, setMediaSettingsOpen] = useState(false);
  const [mirrorDisabledBySettings, setMirrorDisabledBySettings] = useState(false);
  const [remoteImportOpen, setRemoteImportOpen] = useState(false);
  const [localProjectSetupOpen, setLocalProjectSetupOpen] = useState(false);
  const [persistenceAttention, setPersistenceAttention] = useState(false);
  const [persistenceError, setPersistenceError] = useState(false);
  const { operationNotice, showOperationNotice } = useOperationNotice();
  const [isExportingPowerPoint, setIsExportingPowerPoint] = useState(false);
  const [remoteImportStatus, setRemoteImportStatus] = useState<RemoteImportStatus>('loading');
  const [remoteImportProjects, setRemoteImportProjects] = useState<MirrorProjectSummary[]>([]);
  const [remoteImportError, setRemoteImportError] = useState<string | undefined>();
  const [mirrorConfig, setMirrorConfig] = useState<MinioMirrorConfig>(
    () => storedMirrorConfig ?? minioMirrorService.DEFAULT_MINIO_MIRROR_CONFIG,
  );
  const [hasMirrorConfig, setHasMirrorConfig] = useState(Boolean(storedMirrorConfig));
  const {
    clearStockMediaConfig,
    insertStockMedia,
    saveStockMediaConfig,
    searchStockGifs,
    searchStockImages,
    stockGifResults,
    stockImageResults,
    stockMediaConfig,
    stockMediaError,
    stockMediaProviderState,
    stockMediaRecentItems,
    stockMediaSearching,
  } = useStockMediaLibrary({
    activePageId,
    commitProject,
    project,
    setMediaSettingsOpen,
    stockMediaService: services.stockMediaService,
  });
  const {
    clearMediaImportProgress,
    importImageFile,
    mediaImportProgress,
    replaceVideoAsset,
  } = useLocalMediaImport({
    activePageId,
    commitProject,
    project,
  });
  const {
    backgroundPreparation,
    backgroundPreview,
    backgroundSelectionMode,
    backgroundSelectionNotice,
    cancelBackgroundSelectionMode,
    pickBackgroundSubject,
    previewBackgroundSubject,
    refineBackgroundSubject,
    toggleBackgroundSelectionMode,
  } = useBackgroundSubjectSelection({
    backgroundRemovalService: services.backgroundRemovalService,
    commitProject,
    modelStates,
    processingElementIds,
    project,
    selectedElementIds,
    setActiveTab,
    setProcessingElementIds,
  });
  const mirrorConfigRef = useRef<MinioMirrorConfig | null>(storedMirrorConfig);
  const mirrorSyncInFlightRef = useRef(false);
  const mirrorSyncQueuedRef = useRef(false);
  const lastMirroredProjectNameRef = useRef<string | undefined>(undefined);
  const mirrorDebounceRef = useRef<number | undefined>(undefined);
  const queueMirrorSyncRef = useRef<() => void>(() => undefined);
  const syncMirrorNowRef = useRef<(project?: ProjectDocument) => void>(() => undefined);
  projectRef.current = project;
  activePageIdRef.current = activePageId;
  selectedElementIdsRef.current = selectedElementIds;
  hasPersistedLocalProjectRef.current = hasPersistedLocalProject;
  mirrorConfigRef.current = hasMirrorConfig ? mirrorConfig : null;
  queueMirrorSyncRef.current = queueMirrorSync;
  syncMirrorNowRef.current = (projectToSync) => {
    void syncMirrorNow(projectToSync);
  };
  const wasFullscreenRef = useRef(false);
  const presenterPageIdRef = useRef<string | undefined>(undefined);
  const languageDetectionSequenceRef = useRef(0);
  const initialRestorePendingRef = useRef(shouldRestoreStoredProject);
  const skipNextProjectSaveRef = useRef(shouldRestoreStoredProject);
  const autosaveRunIdRef = useRef(0);
  const autosaveRetryTimeoutRef = useRef<number | undefined>(undefined);
  const lastVersionProjectRef = useRef<ProjectDocument>(initialProject);
  const needsFreshPersistenceTargetRef = useRef(false);
  const selection = useMemo<SelectionState>(
    () => ({ pageId: activePageId, elementIds: selectedElementIds, target: selectionTarget }),
    [activePageId, selectedElementIds, selectionTarget],
  );
  const selectedImageElement = useMemo<ImageElement | undefined>(() => {
    if (selectedElementIds.length !== 1) return undefined;
    const element = project.elements[selectedElementIds[0] ?? ''];
    return element?.type === 'image' ? element : undefined;
  }, [project.elements, selectedElementIds]);
  const availableFonts = useMemo(
    () => services.fontImportService.listDownloadableFonts(),
    [services.fontImportService],
  );

  useEffect(() => {
    let cancelled = false;
    const loadLocalFontOptions = async () => {
      const fonts = localFontMirrorSettings.enabled
        ? await services.localFontMirrorService.listAvailableFonts().catch(() => [])
        : [];
      if (!cancelled) setLocalFontOptions(fonts);
    };
    void loadLocalFontOptions();
    return () => {
      cancelled = true;
    };
  }, [
    localFontMirrorSettings.enabled,
    localFontMirrorSettings.folderLabel,
    services.localFontMirrorService,
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
    onPresenterPageChange: (pageId) => {
      presenterPageIdRef.current = pageId;
    },
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
        const previewPageId =
          presenterPageIdRef.current ?? animationPreviewRef.current?.pageId ?? activePageIdRef.current;
        if (previewPageId && projectRef.current.pages.some((page) => page.id === previewPageId)) {
          setActivePageId(previewPageId);
          setActivePageFocusKey((current) => current + 1);
        }
        clearAnimationPreview();
        presenterPageIdRef.current = undefined;
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
      .then(async (savedProject) => {
        if (!isMounted) return;
        if (savedProject) {
          const normalizedProject = editorViewModelProject.normalizeProjectDocument(savedProject);
          await editorViewModelRuntime.loadProjectFonts(normalizedProject, services.fontImportService);
          if (!isMounted) return;
          setProject(normalizedProject);
          setActivePageId(normalizedProject.pages[0]?.id ?? '');
          setPageLanguageCodes({});
          setSelectedElementIds([]);
          lastVersionProjectRef.current = normalizedProject;
          needsFreshPersistenceTargetRef.current = false;
          setLastEditedAt(normalizedProject.updatedAt);
          if (services.projectRepository.getVersionHistory) {
            void services.projectRepository
              .getVersionHistory()
              .then(setVersionHistoryEntries)
              .catch(() => undefined);
          }
          editorViewModelProject.writeProjectNameToUrl(normalizedProject.name);
          setHasPersistedLocalProject(true);
          setPersistenceError(false);
          if (storedMirrorConfig && shouldEnableStoredMirror) {
            syncMirrorNowRef.current(normalizedProject);
          }
        } else if (initialRestorePendingRef.current) {
          setHasPersistedLocalProject(false);
          setPersistenceEnabled(false);
          if (typeof window !== 'undefined') {
            editorPreferences.writePersistencePreference(false);
          }
        }
        initialRestorePendingRef.current = false;
        setHasLoadedProject(true);
      })
      .catch(() => {
        if (!isMounted) return;
        initialRestorePendingRef.current = false;
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
    services.fontImportService,
    services.projectRepository,
    services.storedProjectName,
    shouldEnableStoredMirror,
    storedMirrorConfig,
  ]);

  useEffect(() => {
    if (!hasLoadedProject || !persistenceEnabled) return;
    if (skipNextProjectSaveRef.current) {
      skipNextProjectSaveRef.current = false;
      return;
    }
    if (autosaveRetryTimeoutRef.current !== undefined) {
      window.clearTimeout(autosaveRetryTimeoutRef.current);
      autosaveRetryTimeoutRef.current = undefined;
    }
    const autosaveRunId = autosaveRunIdRef.current + 1;
    autosaveRunIdRef.current = autosaveRunId;

    async function saveProjectWithVersion(projectToSave: ProjectDocument) {
      await services.projectRepository.saveProject(projectToSave);
      setHasPersistedLocalProject(true);
      setLastEditedAt(projectToSave.updatedAt);
      setSaveAnimationKey((current) => current + 1);
      if (!services.projectRepository.saveVersion) return;
      const entry = await services.projectRepository.saveVersion(projectToSave, {
        previousProject: lastVersionProjectRef.current,
      });
      lastVersionProjectRef.current = projectToSave;
      setLastEditedAt(entry.createdAt);
      setVersionHistoryEntries((current) => [
        entry,
        ...current.filter((item) => item.id !== entry.id),
      ]);
    }

    function retryAutosave(projectToSave: ProjectDocument, attempt: number) {
      void saveProjectWithVersion(projectToSave)
        .then(() => {
          if (autosaveRunIdRef.current !== autosaveRunId) return;
          setPersistenceError(false);
          setPersistenceAttention(false);
          queueMirrorSyncRef.current();
          editorViewModelProject.writeProjectNameToUrl(projectToSave.name);
        })
        .catch(() => {
          if (autosaveRunIdRef.current !== autosaveRunId) return;
          if (attempt < AUTOSAVE_RETRY_LIMIT) {
            autosaveRetryTimeoutRef.current = window.setTimeout(() => {
              retryAutosave(projectToSave, attempt + 1);
            }, AUTOSAVE_RETRY_DELAY_MS);
            return;
          }
          setPersistenceEnabled(false);
          setPersistenceAttention(false);
          setPersistenceError(true);
          if (typeof window !== 'undefined') {
            editorPreferences.writePersistencePreference(false);
          }
        });
    }

    retryAutosave(project, 1);
  }, [hasLoadedProject, persistenceEnabled, project, services.projectRepository]);

  useEffect(() => {
    return () => {
      if (mirrorDebounceRef.current !== undefined) {
        window.clearTimeout(mirrorDebounceRef.current);
      }
      if (autosaveRetryTimeoutRef.current !== undefined) {
        window.clearTimeout(autosaveRetryTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pageLanguageCodes[activePageId]) return;
    const sampleText = textTranslationLayout.getPageTextSample(project, activePageId);
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
    cancelBackgroundSelectionMode();
    setPreviewProject(undefined);
    setSelectedVersionId(undefined);
    setVersionHistoryOpen(false);
    skipNextProjectSaveRef.current = true;
    lastVersionProjectRef.current = nextProject;
    setLastEditedAt(nextProject.updatedAt);
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
          state.id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID && state.status === 'ready',
      )
    ) {
      setCreateImageNotice(undefined);
      setAiToolsAttentionModelId(undefined);
    }
  }

  async function downloadModel(id: string) {
    const runId = (modelDownloadRunIdsRef.current[id] ?? 0) + 1;
    modelDownloadRunIdsRef.current = { ...modelDownloadRunIdsRef.current, [id]: runId };
    const isCurrentRun = () => modelDownloadRunIdsRef.current[id] === runId;
    setModelStates((currentStates) =>
      currentStates.map((state) =>
        state.id === id && state.status !== 'ready'
          ? { ...state, status: 'downloading', progress: 10 }
          : state,
      ),
    );
    const next = await services.modelSetupService.downloadModel(id, {
      onProgress: (progress, details) => {
        if (!isCurrentRun()) return;
        setModelStates((currentStates) =>
          currentStates.map((state) =>
            state.id === id
              ? { ...state, status: 'downloading', ...editorViewModelProgress.getDownloadProgressPatch(progress, details) }
              : state,
          ),
        );
      },
    });
    if (!isCurrentRun()) return;
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
    if (id === imageGenerationModel.IMAGE_GENERATION_MODEL_ID && next.status === 'ready') {
      setCreateImageNotice(undefined);
      setAiToolsAttentionModelId(undefined);
    }
  }

  async function cancelModelDownload(id: string) {
    modelDownloadRunIdsRef.current = {
      ...modelDownloadRunIdsRef.current,
      [id]: (modelDownloadRunIdsRef.current[id] ?? 0) + 1,
    };
    await removeModel(id);
  }

  async function removeModel(id: string) {
    if (!services.modelSetupService.removeModel) return;

    const selectedPromptProviderId = promptProviderStates.find(
      (provider) => provider.modelId === id && provider.selected,
    )?.id;
    const selectedTranslationProviderId = translationProviderStates.find(
      (provider) => provider.modelId === id && provider.selected,
    )?.id;
    const selectedLanguageDetectionProviderId = languageDetectionProviderStates.find(
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
    if (services.translatorService.getLanguageDetectionProviderStates) {
      const nextLanguageDetectionProviders =
        selectedLanguageDetectionProviderId && services.translatorService.setLanguageDetectionProvider
          ? await services.translatorService.setLanguageDetectionProvider(
              selectedLanguageDetectionProviderId,
            )
          : await services.translatorService.getLanguageDetectionProviderStates();
      setLanguageDetectionProviderStates(nextLanguageDetectionProviders);
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
    const runId = promptPreparationRunIdRef.current + 1;
    promptPreparationRunIdRef.current = runId;
    const isCurrentRun = () => promptPreparationRunIdRef.current === runId;
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
          if (!isCurrentRun()) return;
          setPromptPreparation((current) => ({
            ...current,
            availability: progress >= 100 ? 'ready' : current.availability,
            ...editorViewModelProgress.getDownloadProgressPatch(
              Math.max(current.progress, 4, Math.min(100, Math.round(progress))),
              details,
            ),
            status: progress >= 100 ? 'ready' : 'downloading',
          }));
        },
      });
      if (!isCurrentRun()) return;
      setPromptPreparation({ availability: 'ready', progress: 100, status: 'ready' });
      setModelStates(await services.modelSetupService.getModelStates());
      if (services.promptService.getProviderStates) {
        setPromptProviderStates(await services.promptService.getProviderStates());
      }
      setPromptApiNotice('Prompt API ready');
    } catch (error: unknown) {
      if (!isCurrentRun()) return;
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

  async function cancelPromptModelDownload(modelId: string) {
    promptPreparationRunIdRef.current += 1;
    setPromptApiNotice(undefined);
    setPromptApiAttention(false);
    setPromptPreparation({ availability: 'downloadable', progress: 0, status: 'idle' });
    await cancelModelDownload(modelId);
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
            ...editorViewModelProgress.getDownloadProgressPatch(
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
                ...editorViewModelProgress.getDownloadProgressPatch(
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
        height: editorViewModelProgress.normalizeImageGenerationDimension(
          imageToReplace?.height ??
            options?.height ??
            imageGenerationModel.DEFAULT_IMAGE_GENERATION_SIZE,
        ),
        ...(options?.seed !== undefined ? { seed: options.seed } : {}),
        ...(options?.steps !== undefined ? { steps: options.steps } : {}),
        width: editorViewModelProgress.normalizeImageGenerationDimension(
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
        past: [
          ...currentHistory.past,
          { pageLanguageCodes: { ...pageLanguageCodes }, project: currentProject },
        ].slice(-50),
        future: [],
      }));

      if (options?.activePageId !== undefined) {
        activePageIdRef.current = options.activePageId;
        setActivePageId(options.activePageId);
      }
      if (options?.selectedElementIds !== undefined) {
        selectedElementIdsRef.current = options.selectedElementIds;
        setSelectedElementIds(options.selectedElementIds);
        setSelectionTarget(
          editorViewModelSelection.getSelectionTargetForElements(options.selectedElementIds),
        );
      }
      return nextProject;
    });
  }

  function selectElement(elementId: string, options?: { additive?: boolean }) {
    if (processingElementIds.includes(elementId)) return;
    cancelBackgroundSelectionMode();
    setSelectionTarget('elements');
    setSelectedElementIds((currentSelection) => {
      return editorViewModelSelection.getNextElementSelection({
        additive: Boolean(options?.additive),
        currentSelection,
        elementId,
      });
    });
  }

  function selectAllElementsOnActivePage() {
    const selectableElementIds = editorViewModelSelection.getSelectableElementIdsOnPage({
      pageId: activePageId,
      processingElementIds,
      project,
    });
    cancelBackgroundSelectionMode();
    setSelectionTarget('elements');
    setSelectedElementIds(selectableElementIds);
  }

  function clearSelection() {
    cancelBackgroundSelectionMode();
    setSelectionTarget('presentation');
    setSelectedElementIds([]);
  }

  function selectSlideBackground() {
    cancelBackgroundSelectionMode();
    setSelectionTarget('slide');
    setSelectedElementIds([]);
  }

  function selectPresentation() {
    cancelBackgroundSelectionMode();
    setSelectionTarget('presentation');
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
      autosaveRunIdRef.current += 1;
      if (autosaveRetryTimeoutRef.current !== undefined) {
        window.clearTimeout(autosaveRetryTimeoutRef.current);
        autosaveRetryTimeoutRef.current = undefined;
      }
      setPersistenceEnabled(false);
      setLocalProjectSetupOpen(false);
      setPersistenceAttention(false);
      setPersistenceError(false);
      showOperationNotice(undefined);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
      return true;
    }

    if (hasPersistedLocalProjectRef.current) {
      return reenablePersistence();
    }

    if (services.persistenceMode === 'opfs') {
      return reenablePersistence();
    }

    setLocalProjectSetupOpen(true);
    return false;
  }

  async function reenablePersistence() {
    try {
      const projectToSave = projectRef.current;
      if (needsFreshPersistenceTargetRef.current && services.projectRepository.saveProjectAs) {
        await services.projectRepository.saveProjectAs(projectToSave, {
          projectDirectoryName: projectToSave.name,
        });
      } else {
        await services.projectRepository.saveProject(projectToSave);
      }
      lastVersionProjectRef.current = projectToSave;
      needsFreshPersistenceTargetRef.current = false;
      setHasPersistedLocalProject(true);
      setLastEditedAt(projectToSave.updatedAt);
      setSaveAnimationKey((current) => current + 1);
      skipNextProjectSaveRef.current = true;
      setPersistenceEnabled(true);
      setPersistenceAttention(false);
      setPersistenceError(false);
      showOperationNotice(undefined);
      setLocalProjectSetupOpen(false);
      editorViewModelProject.writeProjectNameToUrl(projectToSave.name);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(true);
      }
      return true;
    } catch {
      setPersistenceEnabled(false);
      setPersistenceError(true);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
      return false;
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
      void setPersistence(true);
      return;
    }
    try {
      await persistCurrentProject();
      setPersistenceError(false);
      editorViewModelProject.writeProjectNameToUrl(projectRef.current.name);
    } catch {
      setPersistenceEnabled(false);
      setPersistenceError(true);
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
      needsFreshPersistenceTargetRef.current = false;
      setHasPersistedLocalProject(true);
      setPersistenceEnabled(true);
      setPersistenceAttention(false);
      setPersistenceError(false);
      showOperationNotice(undefined);
      setLocalProjectSetupOpen(false);
      setLastEditedAt(projectToSave.updatedAt);
      setSaveAnimationKey((current) => current + 1);
      skipNextProjectSaveRef.current = true;
      editorViewModelProject.writeProjectNameToUrl(projectToSave.name);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(true);
      }
    } catch {
      setPersistenceEnabled(false);
      setPersistenceError(true);
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
    if (!nextName) return false;
    const nextProject = {
      ...projectRef.current,
      name: nextName,
      updatedAt: new Date().toISOString(),
    };
    try {
      if (needsFreshPersistenceTargetRef.current && services.projectRepository.saveProjectAs) {
        await services.projectRepository.saveProjectAs(nextProject, {
          projectDirectoryName: nextName,
        });
      } else {
        await services.projectRepository.saveProject(nextProject, { projectDirectoryName: nextName });
      }
      setProject(nextProject);
      lastVersionProjectRef.current = nextProject;
      needsFreshPersistenceTargetRef.current = false;
      setLastEditedAt(nextProject.updatedAt);
      setSaveAnimationKey((current) => current + 1);
      skipNextProjectSaveRef.current = true;
      setHasPersistedLocalProject(true);
      setPersistenceEnabled(true);
      setPersistenceAttention(false);
      setPersistenceError(false);
      showOperationNotice(undefined);
      setLocalProjectSetupOpen(false);
      editorViewModelProject.writeProjectNameToUrl(nextProject.name);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(true);
      }
      return true;
    } catch {
      setPersistenceEnabled(false);
      setPersistenceError(true);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
      return false;
    }
  }

  async function importProject() {
    if (!services.projectRepository.importProject) return;
    try {
      const importedProject = await services.projectRepository.importProject();
      if (!importedProject) return;
      const normalizedProject = editorViewModelProject.normalizeProjectDocument(importedProject);
      await editorViewModelRuntime.loadProjectFonts(normalizedProject, services.fontImportService);
      setProject(normalizedProject);
      setActivePageId(normalizedProject.pages[0]?.id ?? '');
      setPageLanguageCodes({});
      const nextSelectedId = normalizedProject.pages[0]?.elementIds.at(-1);
      setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
      setHistory({ past: [], future: [] });
      cancelBackgroundSelectionMode();
      skipNextProjectSaveRef.current = true;
      setHasPersistedLocalProject(true);
      setPersistenceEnabled(true);
      setPersistenceError(false);
      lastVersionProjectRef.current = normalizedProject;
      needsFreshPersistenceTargetRef.current = false;
      setLastEditedAt(normalizedProject.updatedAt);
      if (services.projectRepository.getVersionHistory) {
        void services.projectRepository
          .getVersionHistory()
          .then(setVersionHistoryEntries)
          .catch(() => undefined);
      }
      editorViewModelProject.writeProjectNameToUrl(normalizedProject.name);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(true);
      }
    } catch {
      setPersistenceEnabled(false);
      setPersistenceError(true);
      if (typeof window !== 'undefined') {
        editorPreferences.writePersistencePreference(false);
      }
    }
  }

  async function importPowerPoint(input?: PptxImportInput) {
    try {
      showOperationNotice(undefined);
      const pptxInput = input ?? (await powerPointIo.pickImportInput());
      if (!pptxInput) return;
      setPresentationImportProgress({
        detail: `Reading ${pptxInput.file.name}.`,
        progress: 18,
        stage: 'reading',
        title: 'Reading PowerPoint package',
      });
      await editorViewModelRuntime.waitForNextPaint();
      setPresentationImportProgress({
        detail: 'Inspecting slide order, dimensions, and package relationships.',
        progress: 34,
        stage: 'inspecting',
        title: 'Inspecting PPTX structure',
      });
      await editorViewModelRuntime.waitForNextPaint();
      const importedProject = await services.presentationImportService.importPowerPoint(pptxInput);
      setPresentationImportProgress({
        detail: `Extracting text and image objects for ${importedProject.pages.length.toLocaleString()} slides.`,
        progress: 58,
        stage: 'extracting-objects',
        title: 'Extracting text and images',
      });
      await editorViewModelRuntime.waitForNextPaint();
      setPresentationImportProgress({
        detail: 'Matching imported text styles with downloadable Google Fonts.',
        progress: 68,
        stage: 'downloading-fonts',
        title: 'Downloading fonts',
      });
      await editorViewModelRuntime.waitForNextPaint();
      const fontRequests = pptxFontRequests.collect(importedProject);
      const fontImportResult =
        fontRequests.length > 0
          ? await services.fontImportService.resolveAndDownloadFonts(fontRequests).catch(() => ({
              fonts: {},
              resolutions: [],
              warnings: [
                {
                  code: 'font-download-failed',
                  message: 'Could not download one or more imported PowerPoint fonts.',
                  severity: 'warning' as const,
                },
              ],
            }))
          : { fonts: {}, resolutions: [], warnings: [] };
      const importedProjectWithFonts: ProjectDocument = {
        ...importedProject,
        fonts: {
          ...(importedProject.fonts ?? {}),
          ...fontImportResult.fonts,
        },
        ...((importedProject.importWarnings?.length ?? 0) > 0 ||
        fontImportResult.warnings.length > 0
          ? {
              importWarnings: [
                ...(importedProject.importWarnings ?? []),
                ...fontImportResult.warnings,
              ],
            }
          : {}),
      };
      const unresolvedFontFamilies = fontImportResult.resolutions
        .filter((resolution) => resolution.status === 'missing-needs-user')
        .map((resolution) => resolution.requestedFamily);
      const nextMissingPowerPointFonts = getMissingPowerPointFonts(
        importedProjectWithFonts,
        unresolvedFontFamilies,
      );
      setPresentationImportProgress({
        detail: 'Linking original videos and GIFs from the PowerPoint package.',
        progress: 72,
        stage: 'extracting-media',
        title: 'Extracting videos',
      });
      await editorViewModelRuntime.waitForNextPaint();
      setPresentationImportProgress({
        detail: 'Mapping imported transitions and object builds into preview playback.',
        progress: 84,
        stage: 'mapping-animations',
        title: 'Mapping animations',
      });
      await editorViewModelRuntime.waitForNextPaint();
      const normalizedProject = editorViewModelProject.normalizeProjectDocument(importedProjectWithFonts);
      await editorViewModelRuntime.loadProjectFonts(normalizedProject, services.fontImportService);
      setPresentationImportProgress({
        detail: 'Opening the imported project in the editor.',
        progress: 94,
        stage: 'opening',
        title: 'Opening deck',
      });
      await editorViewModelRuntime.waitForNextPaint();
      setProject(normalizedProject);
      setMissingPowerPointFonts(nextMissingPowerPointFonts);
      setActivePageId(normalizedProject.pages[0]?.id ?? '');
      setPageLanguageCodes({});
      const nextSelectedId = normalizedProject.pages[0]?.elementIds.at(-1);
      setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
      setHistory({ past: [], future: [] });
      cancelBackgroundSelectionMode();
      skipNextProjectSaveRef.current = true;
      setHasPersistedLocalProject(false);
      setPersistenceEnabled(false);
      setPersistenceError(false);
      lastVersionProjectRef.current = normalizedProject;
      needsFreshPersistenceTargetRef.current = true;
      setLastEditedAt(normalizedProject.updatedAt);
      setVersionHistoryEntries([]);
      editorViewModelProject.writeProjectNameToUrl(normalizedProject.name);
      setPresentationImportProgress(undefined);
      const missingFontCount = fontImportResult.warnings.filter(
        (warning) => warning.code === 'font-missing',
      ).length;
      const substitutedFontCount = fontImportResult.warnings.filter(
        (warning) => warning.code === 'font-substituted',
      ).length;
      if (missingFontCount > 0 || substitutedFontCount > 0) {
        const parts = [
          missingFontCount > 0
            ? `${missingFontCount.toLocaleString()} missing font${missingFontCount === 1 ? '' : 's'}`
            : undefined,
          substitutedFontCount > 0
            ? `${substitutedFontCount.toLocaleString()} substituted font${
                substitutedFontCount === 1 ? '' : 's'
              }`
            : undefined,
        ].filter(Boolean);
        showOperationNotice({
          message: `PowerPoint imported with ${parts.join(' and ')}.`,
          tone: 'warning',
        });
      }
    } catch (error) {
      setPresentationImportProgress(undefined);
      pptxImportLogger.error('PowerPoint import failed.', error);
      const message = pptxImportLogger.describeError(error).message;
      showOperationNotice({ message: `PowerPoint import failed: ${message}`, tone: 'error' });
    }
  }

  function dismissMissingPowerPointFonts() {
    setMissingPowerPointFonts([]);
  }

  async function replacePowerPointFont(missingFamily: string, replacementFamily: string) {
    const trimmedReplacement = replacementFamily.trim();
    if (!trimmedReplacement) return;
    const matchingElements = Object.values(projectRef.current.elements).filter((element) => {
      if (element.type !== 'text') return false;
      return getFirstFontFamily(element.fontFamily)?.toLowerCase() === missingFamily.toLowerCase();
    }) as Array<Extract<ProjectDocument['elements'][string], { type: 'text' }>>;
    if (matchingElements.length === 0) {
      setMissingPowerPointFonts((current) =>
        current.filter((font) => font.family.toLowerCase() !== missingFamily.toLowerCase()),
      );
      return;
    }

    const fontWeights = Array.from(
      new Set(matchingElements.map((element) => (element.fontWeight >= 700 ? 700 : 400))),
    );
    const result = await services.fontImportService.resolveAndDownloadFonts(
      fontWeights.map((fontWeight) => ({
        family: trimmedReplacement,
        fontStyle: 'normal',
        fontWeight,
      })),
    );
    if (result.warnings.some((warning) => warning.code === 'font-missing')) {
      throw new Error(result.warnings[0]?.message ?? `${trimmedReplacement} could not be downloaded.`);
    }

    commitProject((currentProject) => ({
      ...currentProject,
      fonts: {
        ...(currentProject.fonts ?? {}),
        ...result.fonts,
      },
      elements: Object.fromEntries(
        Object.entries(currentProject.elements).map(([elementId, element]) => {
          if (
            element.type !== 'text' ||
            getFirstFontFamily(element.fontFamily)?.toLowerCase() !== missingFamily.toLowerCase()
          ) {
            return [elementId, element];
          }
          return [elementId, { ...element, fontFamily: trimmedReplacement }];
        }),
      ),
      updatedAt: new Date().toISOString(),
    }));
    await editorViewModelRuntime.loadProjectFonts(projectRef.current, services.fontImportService);
    setMissingPowerPointFonts((current) =>
      current.filter((font) => font.family.toLowerCase() !== missingFamily.toLowerCase()),
    );
  }

  async function exportPowerPoint() {
    if (isExportingPowerPoint) return;
    setIsExportingPowerPoint(true);
    try {
      showOperationNotice(
        { message: 'Exporting PowerPoint...', tone: 'info' },
        { persistent: true },
      );
      await editorViewModelRuntime.waitForNextPaint();
      const result = await services.presentationExportService.exportPowerPoint(project, {
        onProgress: (progress) => {
          showOperationNotice(powerPointIo.formatExportProgress(progress), { persistent: true });
        },
      });
      showOperationNotice(
        {
          detail: 'Saving the file from the browser.',
          message: 'Downloading PowerPoint',
          tone: 'info',
        },
        { persistent: true },
      );
      services.exportService.downloadBlob(
        result.blob,
        services.exportService.getPowerPointFileName(project),
      );
      showOperationNotice({
        message: powerPointIo.summarizeExport(result),
        tone: result.warnings.length > 0 ? 'warning' : 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error.';
      showOperationNotice({ message: `PowerPoint export failed: ${message}`, tone: 'error' });
    } finally {
      setIsExportingPowerPoint(false);
    }
  }

  const importPowerPointRef = useRef(importPowerPoint);
  const showOperationNoticeRef = useRef(showOperationNotice);
  showOperationNoticeRef.current = showOperationNotice;

  useEffect(() => {
    if (!powerPointIo.consumeLocalSampleImportRequest()) return;
    void powerPointIo.loadLocalSampleInput()
      .then((input) => importPowerPointRef.current(input))
      .catch((error: unknown) => {
        pptxImportLogger.error('Local PowerPoint sample import failed.', error);
        const message = pptxImportLogger.describeError(error).message;
        showOperationNoticeRef.current({
          message: `PowerPoint import failed: ${message}`,
          tone: 'error',
        });
      });
  }, []);

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

  function setLocalFontMirrorEnabled(enabled: boolean) {
    setLocalFontMirrorSettings(services.localFontMirrorService.setEnabled(enabled));
  }

  async function chooseLocalFontMirrorFolder() {
    setLocalFontMirrorSettings(await services.localFontMirrorService.chooseFontFolder());
  }

  function closeRemoteImport() {
    setRemoteImportOpen(false);
  }

  function saveMirrorConfig(config: MinioMirrorConfig) {
    persistMirrorConfig(config);
    editorPreferences.writeMirrorPreference(true);
    setMirrorDisabledBySettings(false);
    setMirrorState({ enabled: true, status: 'idle' });
    setMirrorSettingsOpen(false);
    void syncMirrorNow();
  }

  function persistMirrorConfig(config: MinioMirrorConfig) {
    services.mirrorService.saveConfig(config);
    setMirrorConfig(config);
    setHasMirrorConfig(true);
    mirrorConfigRef.current = config;
  }

  function setMirrorEnabled(
    enabled: boolean,
    options?: { config?: MinioMirrorConfig | undefined; fromSettings?: boolean },
  ) {
    if (enabled) {
      if (options?.config) {
        persistMirrorConfig(options.config);
      }
      if (!mirrorConfigRef.current) {
        openMirrorSettings();
        return;
      }
      editorPreferences.writeMirrorPreference(true);
      setMirrorDisabledBySettings(false);
      setMirrorState({ enabled: true, status: 'idle' });
      void syncMirrorNow();
      return;
    }
    editorPreferences.writeMirrorPreference(false);
    setMirrorDisabledBySettings(Boolean(options?.fromSettings));
    setMirrorState({ enabled: false, status: 'disabled' });
  }

  function setMirrorEnabledFromSettings(enabled: boolean, config: MinioMirrorConfig) {
    setMirrorEnabled(enabled, { config, fromSettings: true });
  }

  async function testMirrorConnection(
    config: MinioMirrorConfig,
    options?: { onProgress?: (progress: LocalFontMirrorProgress) => void },
  ) {
    setMirrorState({ enabled: true, status: 'syncing' });
    try {
      options?.onProgress?.({ label: 'Checking storage', stage: 'checking-local-fonts' });
      await services.mirrorService.listProjects(config);
      setMirrorState({ enabled: true, status: 'idle' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'S3-compatible connection failed.';
      setMirrorState({
        enabled: true,
        status: 'failed',
        error: message,
      });
      throw new Error(message, { cause: error });
    }
  }

  async function prepareProjectFontsForPublicShare(
    options?: { onProgress?: (progress: LocalFontMirrorProgress) => void },
  ) {
    const result = await services.localFontMirrorService.importProjectFonts(projectRef.current, {
      ...(options?.onProgress ? { onProgress: options.onProgress } : {}),
    });
    if (result.project !== projectRef.current) {
      setProject(result.project);
      projectRef.current = result.project;
      await editorViewModelRuntime.loadProjectFonts(result.project, services.fontImportService).catch(() => undefined);
    }
    return result;
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
    setMirrorSyncProgress({ current: 0, label: 'Preparing mirror', total: 1 });
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
        {
          onProgress: setMirrorSyncProgress,
        },
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
      setMirrorSyncProgress(undefined);
      if (mirrorSyncQueuedRef.current) {
        const shouldSyncLatestProject = projectRef.current !== projectToSync;
        mirrorSyncQueuedRef.current = false;
        if (shouldSyncLatestProject) {
          void syncMirrorNow();
        }
      }
    }
  }

  function requestMirrorNow() {
    if (!persistenceEnabled) {
      setPersistenceAttention(true);
      showOperationNotice({ message: 'Save the project before mirroring.', tone: 'warning' });
      return;
    }
    if (!mirrorConfigRef.current) {
      openMirrorSettings();
      return;
    }
    if (!mirrorState.enabled) {
      editorPreferences.writeMirrorPreference(true);
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
      await services.projectRepository.prepareImportMirrorFiles?.();
      const files = await services.mirrorService.downloadProject(projectId, config);
      const importedProject = await services.projectRepository.importMirrorFiles(files);
      const normalizedProject = editorViewModelProject.normalizeProjectDocument(importedProject);
      await editorViewModelRuntime.loadProjectFonts(normalizedProject, services.fontImportService);
      setProject(normalizedProject);
      setActivePageId(normalizedProject.pages[0]?.id ?? '');
      setPageLanguageCodes({});
      setSelectedElementIds([]);
      setHistory({ past: [], future: [] });
      cancelBackgroundSelectionMode();
      skipNextProjectSaveRef.current = true;
      setHasPersistedLocalProject(true);
      setPersistenceEnabled(true);
      setPersistenceError(false);
      lastVersionProjectRef.current = normalizedProject;
      needsFreshPersistenceTargetRef.current = false;
      setLastEditedAt(normalizedProject.updatedAt);
      if (services.projectRepository.getVersionHistory) {
        void services.projectRepository
          .getVersionHistory()
          .then(setVersionHistoryEntries)
          .catch(() => undefined);
      }
      editorViewModelProject.writeProjectNameToUrl(normalizedProject.name);
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
    const normalizedVersionProject = editorViewModelProject.normalizeProjectDocument(versionProject);
    await editorViewModelRuntime.loadProjectFonts(normalizedVersionProject, services.fontImportService);
    setSelectedVersionId(versionId);
    setPreviewProject(normalizedVersionProject);
    const nextPageId = entry?.firstChangedPageId ?? normalizedVersionProject.pages[0]?.id ?? '';
    activePageIdRef.current = nextPageId;
    setActivePageId(nextPageId);
    setActivePageFocusKey((current) => current + 1);
    setSelectedElementIds(entry?.firstChangedElementId ? [entry.firstChangedElementId] : []);
  }

  async function restoreVersion(versionId: string) {
    if (!services.projectRepository.loadVersion) return;
    const restoredProject = await services.projectRepository.loadVersion(versionId);
    if (!restoredProject) return;
    const normalizedProject = editorViewModelProject.normalizeProjectDocument({
      ...restoredProject,
      updatedAt: new Date().toISOString(),
    });
    await editorViewModelRuntime.loadProjectFonts(normalizedProject, services.fontImportService);
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
    cancelBackgroundSelectionMode();
    setActivePageId(page.id);
    setSelectedElementIds([]);
  }

  function updateElementFrame(elementId: string, patch: ElementFramePatch) {
    commitProject((currentProject) =>
      new basicCommands.UpdateElementFrameCommand(
        elementId,
        editorViewModelText.getFramePatchWithTextMinimum(currentProject, elementId, patch),
      ).execute(currentProject),
    );
  }

  function updateElementFrames(patches: Record<string, ElementFramePatch>) {
    commitProject((currentProject) =>
      new basicCommands.UpdateElementFramesCommand(patches).execute(currentProject),
    );
  }

  function updateTextContent(elementId: string, text: string) {
    commitProject((currentProject) =>
      editorViewModelText.updateTextContent(currentProject, elementId, text),
    );
  }

  function updateElementStyle(elementId: string, patch: ElementStylePatch) {
    commitProject((currentProject) =>
      editorViewModelText.updateElementStyle(currentProject, elementId, patch),
    );
  }

  async function downloadFontForSelection(family: string) {
    const selectedElementId = selectedElementIdsRef.current[0];
    if (!selectedElementId) throw new Error('Select a text element before downloading a font.');
    const selectedElement = projectRef.current.elements[selectedElementId];
    if (!selectedElement || selectedElement.type !== 'text') {
      throw new Error('Select a text element before downloading a font.');
    }

    const result = await services.fontImportService.resolveAndDownloadFonts([
      {
        family,
        fontStyle: 'normal',
        fontWeight: selectedElement.fontWeight >= 700 ? 700 : 400,
      },
    ]);
    const font = Object.values(result.fonts)[0];
    if (!font) {
      throw new Error(result.warnings[0]?.message ?? 'Font download failed.');
    }

    commitProject((currentProject) => {
      return editorViewModelText.applyFontFamilyWithFonts({
        elementId: selectedElementId,
        font,
        fonts: result.fonts,
        project: currentProject,
      });
    });
  }

  async function importLocalFontForSelection(family: string) {
    const selectedElementId = selectedElementIdsRef.current[0];
    if (!selectedElementId) throw new Error('Select a text element before adding a local font.');
    const selectedElement = projectRef.current.elements[selectedElementId];
    if (!selectedElement || selectedElement.type !== 'text') {
      throw new Error('Select a text element before adding a local font.');
    }

    const result = await services.localFontMirrorService.importFontFamily(projectRef.current, {
      family,
      fontStyle: 'normal',
      fontWeight: selectedElement.fontWeight >= 700 ? 700 : 400,
    });
    const font = result.addedFonts[0];
    if (!font) {
      throw new Error(result.warnings[0]?.message ?? 'Local font was not found.');
    }

    await editorViewModelRuntime.loadProjectFonts(result.project, services.fontImportService);
    commitProject((currentProject) => {
      return editorViewModelText.applyFontFamilyWithFonts({
        elementId: selectedElementId,
        font,
        fonts: result.project.fonts ?? {},
        project: currentProject,
      });
    });
  }

  function updatePageBackground(background: PageBackground) {
    commitProject((currentProject) =>
      new basicCommands.UpdatePageBackgroundCommand(activePageId, background).execute(
        currentProject,
      ),
    );
  }

  function applyTheme(themeId: string) {
    commitProject((currentProject) =>
      new basicCommands.ApplyThemeCommand(themeId).execute(currentProject),
    );
  }

  function editTheme(themeId: string) {
    const theme = projectRef.current.themes?.[themeId];
    if (!theme) return;
    commitProject((currentProject) => new basicCommands.EditThemeCommand(theme).execute(currentProject));
  }

  function changeTheme() {
    const themeId = projectRef.current.themeId ?? Object.keys(projectRef.current.themes ?? {})[0];
    if (!themeId) return;
    applyTheme(themeId);
  }

  function applySlideLayout(pageId: string, layoutId: string) {
    commitProject((currentProject) =>
      new basicCommands.ApplySlideLayoutCommand(pageId, layoutId).execute(currentProject),
    );
  }

  function editSlideLayout(layoutId: string) {
    const layout = projectRef.current.slideLayouts?.[layoutId];
    if (!layout) return;
    commitProject((currentProject) =>
      new basicCommands.EditSlideLayoutCommand(layout).execute(currentProject),
    );
  }

  function toggleSlideLayoutPlaceholder(
    layoutId: string,
    role: 'body' | 'footer' | 'slideNumber' | 'title',
    visible: boolean,
  ) {
    commitProject((currentProject) =>
      new basicCommands.ToggleSlideLayoutPlaceholderVisibilityCommand(
        layoutId,
        role,
        visible,
      ).execute(currentProject),
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

    const pageIdsByElementId = new Map(
      project.pages.flatMap((page) => page.elementIds.map((elementId) => [elementId, page.id] as const)),
    );
    const pageById = new Map(project.pages.map((page) => [page.id, page]));
    const concurrency = scope === 'deck' ? DECK_TRANSLATION_CONCURRENCY : elementIds.length;
    const shouldTrackDeckProgress = scope === 'deck';
    const pendingElementCountByPageId = new Map<string, number>();
    const activeElementCountByPageId = new Map<string, number>();
    let completedPageCount = 0;
    let totalPageCount = 0;

    if (shouldTrackDeckProgress) {
      for (const elementId of elementIds) {
        const pageId = pageIdsByElementId.get(elementId);
        if (!pageId) continue;
        pendingElementCountByPageId.set(pageId, (pendingElementCountByPageId.get(pageId) ?? 0) + 1);
      }
      totalPageCount = pendingElementCountByPageId.size;
      setDeckTranslationProgress({
        activePageIds: [],
        completedPages: 0,
        currentPageName: 'Preparing slides',
        totalPages: totalPageCount,
      });
    }

    const updateDeckTranslationProgress = (currentPageId: string | undefined) => {
      if (!shouldTrackDeckProgress) return;
      const currentPage = currentPageId ? pageById.get(currentPageId) : undefined;
      setDeckTranslationProgress({
        activePageIds: Array.from(activeElementCountByPageId.keys()),
        completedPages: completedPageCount,
        currentPageName: currentPage?.name ?? 'slides',
        totalPages: totalPageCount,
      });
    };

    const translatedEntries = await textTranslationLayout.mapWithConcurrency(
      elementIds,
      concurrency,
      async (elementId) => {
        const element = project.elements[elementId];
        if (!element || element.type !== 'text') return undefined;
        const pageId = pageIdsByElementId.get(elementId);
        if (shouldTrackDeckProgress && pageId) {
          activeElementCountByPageId.set(
            pageId,
            (activeElementCountByPageId.get(pageId) ?? 0) + 1,
          );
          updateDeckTranslationProgress(pageId);
        }
        const translatedText = await services.translatorService.translate(
          element.text,
          targetLanguage,
          options?.sourceLanguage ? { sourceLanguage: options.sourceLanguage } : undefined,
        );
        if (shouldTrackDeckProgress && pageId) {
          const activeElementCount = (activeElementCountByPageId.get(pageId) ?? 1) - 1;
          if (activeElementCount > 0) {
            activeElementCountByPageId.set(pageId, activeElementCount);
          } else {
            activeElementCountByPageId.delete(pageId);
          }
          const pendingElementCount = (pendingElementCountByPageId.get(pageId) ?? 1) - 1;
          if (pendingElementCount > 0) {
            pendingElementCountByPageId.set(pageId, pendingElementCount);
          } else {
            pendingElementCountByPageId.delete(pageId);
            completedPageCount += 1;
          }
          updateDeckTranslationProgress(pageId);
        }
        const page = pageById.get(pageId ?? '');
        return [
          elementId,
          textTranslationLayout.fitTranslatedTextToOriginalFrame(element, translatedText, page),
        ] as const;
      },
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
          .map((elementId) => pageIdsByElementId.get(elementId))
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
    await setTranslationTargetLanguageForSource(languageCode);
  }

  async function setTranslationTargetLanguageForSource(
    languageCode: string,
    options?: { sourceLanguage?: string },
  ) {
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
      const sourceLanguage = options?.sourceLanguage
        ? translationLanguageUtils.normalizeLanguageCode(options.sourceLanguage)
        : translationLanguageUtils.normalizeLanguageCode(
            await services.translatorService.detectLanguage(sampleText, {
              onProgress: (progress, details) => {
                setTranslationPreparation((current) => ({
                  ...editorViewModelProgress.getDownloadProgressPatch(
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
              ...editorViewModelProgress.getDownloadProgressPatch(
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

  function setActiveSlideLanguage(languageCode: string) {
    const normalizedLanguageCode = translationLanguageUtils.normalizeLanguageCode(languageCode);
    setPageLanguageCodes((current) => ({
      ...current,
      [activePageId]: normalizedLanguageCode,
    }));
    setTranslationNotice(undefined);
    if (translationTargetLanguage) {
      void setTranslationTargetLanguageForSource(translationTargetLanguage, {
        sourceLanguage: normalizedLanguageCode,
      });
    }
  }

  function getTranslationSourceLanguage(scope: TranslationScope, options?: { pageId?: string }) {
    if (scope === 'deck') {
      return translationLanguageUtils.normalizeLanguageCode(activeSlideLanguage.code);
    }
    const pageId = options?.pageId ?? activePageId;
    return translationLanguageUtils.normalizeLanguageCode(pageLanguageCodes[pageId]);
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
      const sourceLanguage = getTranslationSourceLanguage(scope, options);
      if (scope === 'deck') {
        const normalizedTargetLanguage =
          translationLanguageUtils.normalizeLanguageCode(translationTargetLanguage);
        if (sourceLanguage !== normalizedTargetLanguage) {
          await services.translatorService.prepareTranslation(
            sourceLanguage,
            normalizedTargetLanguage,
          );
        }
        const deckElementIds = getTranslatableTextElementIds('deck');
        const deckElementIdSet = new Set(deckElementIds);
        const deckPageIds = project.pages
          .filter((page) => page.elementIds.some((elementId) => deckElementIdSet.has(elementId)))
          .map((page) => page.id);
        const firstDeckPage = project.pages.find((page) => page.id === deckPageIds[0]);
        setDeckTranslationProgress({
          activePageIds: firstDeckPage ? [firstDeckPage.id] : [],
          completedPages: 0,
          currentPageName: firstDeckPage?.name ?? 'slides',
          totalPages: deckPageIds.length,
        });
      }
      const translationOptions =
        sourceLanguage || translationPreparation.sourceLanguage || options?.pageId
          ? {
              ...(options?.pageId ? { pageId: options.pageId } : {}),
              ...(sourceLanguage || translationPreparation.sourceLanguage
                ? {
                    sourceLanguage: sourceLanguage ?? translationPreparation.sourceLanguage,
                  }
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
      setDeckTranslationProgress(undefined);
      setIsTranslating(false);
    }
  }

  function createProjectForAutomation(input: { name?: string }) {
    const blankProject = sampleProject.createBlankProject();
    const nextProject = editorViewModelProject.normalizeProjectDocument({
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
    return editorViewModelElements.getSelectedElementsForClipboard({
      activePageId,
      project,
      selectedElementIds,
    });
  }

  function copySelectedElements() {
    const selectedElements = getSelectedElementsForClipboard();
    if (selectedElements.length === 0) return;
    setElementClipboard({
      assets: editorViewModelElements.collectClipboardAssets(project, selectedElements),
      elements: selectedElements.map((element) => ({ ...element })),
    });
  }

  function pasteCopiedElements() {
    if (elementClipboard.elements.length === 0) return false;
    const pastedElements = editorViewModelElements.createPastedElements({
      createElementId: (sourceElementId) => createPrefixedId(`${sourceElementId}-copy`),
      elements: elementClipboard.elements,
    });

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
    cancelBackgroundSelectionMode();
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
    const elementId = createPrefixedId('text');
    const nextElement = editorViewModelElements.createTextElement({
      elementId,
      page,
      preset,
      project,
      selectedElement,
    });

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
    const elementId = createPrefixedId('shape');
    const nextElement = editorViewModelElements.createShapeElement({
      elementId,
      page,
      selectedElement,
      shape,
    });

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
    const pageId = createPrefixedId('page');
    const nextPage = editorViewModelPages.createInsertedPage({
      activePageId,
      afterPageId,
      pageId,
      project,
    });
    if (!nextPage) return;

    commitProject(
      (currentProject) => editorViewModelPages.insertPageAfter(currentProject, afterPageId, nextPage),
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
    const nextPageId = editorViewModelPages.getNextPageIdAfterDelete(project, pageId);
    if (nextPageId === undefined) return;
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

  function updatePageSpeakerNotes(pageId: string, speakerNotes: string) {
    commitProject((currentProject) => ({
      ...currentProject,
      updatedAt: new Date().toISOString(),
      pages: currentProject.pages.map((page) =>
        page.id === pageId ? { ...page, speakerNotes } : page,
      ),
    }));
  }

  function addTranscriptRecording(recording: TranscriptRecording) {
    commitProject((currentProject) => ({
      ...currentProject,
      recordings: {
        ...(currentProject.recordings ?? {}),
        [recording.id]: recording,
      },
      updatedAt: new Date().toISOString(),
    }));
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
    const previousSnapshot = history.past.at(-1);
    if (!previousSnapshot) return;
    const previousProject = previousSnapshot.project;

    setHistory((currentHistory) => ({
      past: currentHistory.past.slice(0, -1),
      future: [{ pageLanguageCodes: { ...pageLanguageCodes }, project }, ...currentHistory.future],
    }));
    setProject(previousProject);
    setPageLanguageCodes(previousSnapshot.pageLanguageCodes);
    const nextActivePageId = editorViewModelHistory.getActivePageIdForProject(
      previousProject,
      activePageId,
    );
    setActivePageId(nextActivePageId);
    setSelectedElementIds(
      editorViewModelHistory.getSelectionForProject({
        currentSelection: selectedElementIds,
        pageId: nextActivePageId,
        project: previousProject,
      }),
    );
  }

  function redo() {
    const nextSnapshot = history.future[0];
    if (!nextSnapshot) return;
    const nextProject = nextSnapshot.project;

    setHistory((currentHistory) => ({
      past: [...currentHistory.past, { pageLanguageCodes: { ...pageLanguageCodes }, project }],
      future: currentHistory.future.slice(1),
    }));
    setProject(nextProject);
    setPageLanguageCodes(nextSnapshot.pageLanguageCodes);
    const nextActivePageId = editorViewModelHistory.getActivePageIdForProject(
      nextProject,
      activePageId,
    );
    setActivePageId(nextActivePageId);
    setSelectedElementIds(
      editorViewModelHistory.getSelectionForProject({
        currentSelection: selectedElementIds,
        pageId: nextActivePageId,
        project: nextProject,
      }),
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

  function updateMediaPlayback(elementId: string, patch: MediaPlaybackPatch) {
    commitProject((currentProject) =>
      new basicCommands.UpdateMediaPlaybackCommand(elementId, patch).execute(currentProject),
    );
  }

  return {
    project: previewProject ?? project,
    automation,
    activePageId,
    activePageFocusKey,
    zoomPercent,
    pagesPanelOpen,
    isFullscreen,
    persistenceEnabled,
    presentationImportProgress,
    missingPowerPointFonts,
    mediaImportProgress,
    persistenceAttention,
    persistenceError,
    operationNotice,
    isExportingPowerPoint,
    mirrorState,
    mirrorSyncProgress,
    mirrorDisabledBySettings,
    mirrorConfig,
    hasMirrorConfig,
    localFontMirrorSettings,
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
    availableFonts,
    localFontOptions,
    downloadableFonts: services.fontImportService.listDownloadableFonts(),
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
    setLocalFontMirrorEnabled,
    chooseLocalFontMirrorFolder,
    prepareProjectFontsForPublicShare,
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
    dismissMissingPowerPointFonts,
    replacePowerPointFont,
    exportPowerPoint,
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
    deckTranslationProgress,
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
    cancelPromptModelDownload,
    setCreateImageOptions,
    setPromptProvider,
    setTranslationProvider,
    setLanguageDetectionProvider,
    setActiveSlideLanguage,
    setTranslationTargetLanguage,
    setTranslationTargetLanguageForSource,
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
    cancelModelDownload,
    removeModel,
    selectElement,
    selectAllElementsOnActivePage,
    clearSelection,
    selectSlideBackground,
    selectPresentation,
    selectPage,
    activateScrolledPage,
    addPage,
    duplicatePage,
    deletePage,
    reorderPage,
    renamePage,
    setPageVisibility,
    updatePageSpeakerNotes,
    addTranscriptRecording,
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
    downloadFontForSelection,
    importLocalFontForSelection,
    updateMediaPlayback,
    updatePageBackground,
    applyTheme,
    editTheme,
    changeTheme,
    applySlideLayout,
    editSlideLayout,
    toggleSlideLayoutPlaceholder,
    clearPageTransition,
    setPageTransition,
    setElementAnimationBuilds,
    clearElementAnimationBuild,
    reorderElementAnimationBuild,
    playAnimationPreview,
    playPresentationPreview,
    advanceAnimationPreview,
    advancePresentationPreview,
    clearAnimationPreview,
    rewindPresentationPreview,
    updateTextContent,
    setElementVisibility,
    setElementLock,
    deleteElement,
    reorderElement,
    removeAsset,
    importImageFile,
    importMediaFile: importImageFile,
    clearMediaImportProgress,
    replaceVideoAsset,
  };
}
