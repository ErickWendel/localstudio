import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppServices } from '../../app/composition';
import {
  AddElementsCommand,
  AddImageElementCommand,
  AlignElementCommand,
  DeleteElementCommand,
  DuplicateElementCommand,
  ReorderElementCommand,
  SetElementLockCommand,
  SetElementVisibilityCommand,
  SetZOrderCommand,
  TranslateTextElementsCommand,
  UpdateElementFramesCommand,
  UpdateElementStyleCommand,
  UpdateElementFrameCommand,
  UpdatePageBackgroundCommand,
  UpdateTextContentCommand,
  type AlignMode,
  type ElementFramePatch,
  type ElementStylePatch,
  type ZOrderMode,
} from '../../domain/commands/basicCommands';
import { fitImageWithinPage } from '../../domain/imageSizing';
import type { DesignElement, Page, PageBackground, ProjectDocument, SelectionState } from '../../domain/model';
import { SAMPLE_HERO_IMAGE_SIZE, SAMPLE_HERO_IMAGE_URL } from '../../domain/sampleProject';
import type { ModelState, PromptApiAvailability } from '../../services/interfaces';
import { IMAGE_EDITING_MODEL_ID } from '../../services/modelSetupService';

export type RightPanelTab = 'layout' | 'design' | 'ai-tools';

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

interface TranslationPreparationState {
  progress: number;
  sourceLanguage?: string;
  status: 'idle' | 'downloading' | 'ready' | 'failed';
}

interface PromptPreparationState {
  availability: PromptApiAvailability;
  progress: number;
  status: 'idle' | 'downloading' | 'ready' | 'failed';
}

interface ElementClipboardState {
  assets: ProjectDocument['assets'];
  elements: DesignElement[];
}

const PERSISTENCE_PREFERENCE_KEY = 'ew-canvas-ai.persistence-enabled';
const TRANSLATION_TARGET_LANGUAGE_KEY = 'localstudio.ai.translation-target-language';
const IMAGE_EDITING_MODEL_REQUIRED_MESSAGE = 'You must download the image editing tools first.';
const PROMPT_API_REQUIRED_MESSAGE = 'Prompt API must be prepared before using prompt-to-slides.';
const BACKGROUND_PREVIEW_DEBOUNCE_MS = 120;
const DEFAULT_SLIDE_LANGUAGE_CODE = 'pt';
const PASTED_ELEMENT_OFFSET = 32;
export const TRANSLATION_LANGUAGE_OPTIONS = [
  { code: 'ar', flag: '🇸🇦', label: 'Arabic' },
  { code: 'bn', flag: '🇧🇩', label: 'Bengali' },
  { code: 'bg', flag: '🇧🇬', label: 'Bulgarian' },
  { code: 'zh', flag: '🇨🇳', label: 'Chinese' },
  { code: 'zh-Hant', flag: '🇹🇼', label: 'Chinese (Traditional)' },
  { code: 'hr', flag: '🇭🇷', label: 'Croatian' },
  { code: 'cs', flag: '🇨🇿', label: 'Czech' },
  { code: 'da', flag: '🇩🇰', label: 'Danish' },
  { code: 'nl', flag: '🇳🇱', label: 'Dutch' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'fi', flag: '🇫🇮', label: 'Finnish' },
  { code: 'fr', flag: '🇫🇷', label: 'French' },
  { code: 'de', flag: '🇩🇪', label: 'German' },
  { code: 'el', flag: '🇬🇷', label: 'Greek' },
  { code: 'iw', flag: '🇮🇱', label: 'Hebrew' },
  { code: 'hi', flag: '🇮🇳', label: 'Hindi' },
  { code: 'hu', flag: '🇭🇺', label: 'Hungarian' },
  { code: 'id', flag: '🇮🇩', label: 'Indonesian' },
  { code: 'it', flag: '🇮🇹', label: 'Italian' },
  { code: 'ja', flag: '🇯🇵', label: 'Japanese' },
  { code: 'kn', flag: '🇮🇳', label: 'Kannada' },
  { code: 'ko', flag: '🇰🇷', label: 'Korean' },
  { code: 'lt', flag: '🇱🇹', label: 'Lithuanian' },
  { code: 'mr', flag: '🇮🇳', label: 'Marathi' },
  { code: 'no', flag: '🇳🇴', label: 'Norwegian' },
  { code: 'pl', flag: '🇵🇱', label: 'Polish' },
  { code: 'pt', flag: '🇧🇷', label: 'Portuguese' },
  { code: 'ro', flag: '🇷🇴', label: 'Romanian' },
  { code: 'ru', flag: '🇷🇺', label: 'Russian' },
  { code: 'sk', flag: '🇸🇰', label: 'Slovak' },
  { code: 'sl', flag: '🇸🇮', label: 'Slovenian' },
  { code: 'es', flag: '🇪🇸', label: 'Spanish' },
  { code: 'sv', flag: '🇸🇪', label: 'Swedish' },
  { code: 'ta', flag: '🇮🇳', label: 'Tamil' },
  { code: 'te', flag: '🇮🇳', label: 'Telugu' },
  { code: 'th', flag: '🇹🇭', label: 'Thai' },
  { code: 'tr', flag: '🇹🇷', label: 'Turkish' },
  { code: 'uk', flag: '🇺🇦', label: 'Ukrainian' },
  { code: 'vi', flag: '🇻🇳', label: 'Vietnamese' },
];

function normalizeLanguageCode(languageCode: string | undefined) {
  const normalized = languageCode?.trim();
  if (!normalized) return DEFAULT_SLIDE_LANGUAGE_CODE;
  const lower = normalized.toLowerCase();
  const aliases: Record<string, string> = {
    ca: 'es',
    gl: 'es',
    he: 'iw',
    'pt-br': 'pt',
    'pt-pt': 'pt',
    nb: 'no',
    nn: 'no',
    'zh-hk': 'zh-Hant',
    'zh-mo': 'zh-Hant',
    'zh-tw': 'zh-Hant',
  };
  const aliased = aliases[lower] ?? lower;
  if (aliased === 'zh-hant') return 'zh-Hant';
  if (TRANSLATION_LANGUAGE_OPTIONS.some((option) => option.code === aliased)) return aliased;
  const baseLanguage = aliased.split('-')[0];
  if (baseLanguage && TRANSLATION_LANGUAGE_OPTIONS.some((option) => option.code === baseLanguage)) {
    return baseLanguage;
  }
  return DEFAULT_SLIDE_LANGUAGE_CODE;
}

function getLanguageOption(languageCode: string | undefined) {
  const code = normalizeLanguageCode(languageCode);
  return (
    TRANSLATION_LANGUAGE_OPTIONS.find((option) => option.code === code) ??
    TRANSLATION_LANGUAGE_OPTIONS.find((option) => option.code === DEFAULT_SLIDE_LANGUAGE_CODE)!
  );
}

function getLanguageDisplayCode(languageCode: string) {
  return languageCode === 'zh-Hant' ? 'ZH-HANT' : languageCode.toUpperCase();
}

function readPersistencePreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PERSISTENCE_PREFERENCE_KEY) === 'true';
}

function readTranslationTargetLanguage() {
  if (typeof window === 'undefined') return '';
  const storedTarget = window.localStorage.getItem(TRANSLATION_TARGET_LANGUAGE_KEY);
  return TRANSLATION_LANGUAGE_OPTIONS.some((option) => option.code === storedTarget) ? storedTarget ?? '' : '';
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
  const shouldRestoreHeroImage = Boolean(project.assets['asset-hero']) && !project.elements['image-hero'];
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
      ...(isLegacyScaledHero ? SAMPLE_HERO_IMAGE_SIZE : {}),
      visible: element.visible ?? true,
    };
  }

  if (shouldRestoreHeroImage) {
    elements['image-hero'] = {
      id: 'image-hero',
      type: 'image',
      assetId: 'asset-hero',
      x: SAMPLE_HERO_IMAGE_SIZE.x,
      y: SAMPLE_HERO_IMAGE_SIZE.y,
      width: SAMPLE_HERO_IMAGE_SIZE.width,
      height: SAMPLE_HERO_IMAGE_SIZE.height,
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
              objectUrl: project.assets['asset-hero'].objectUrl ?? SAMPLE_HERO_IMAGE_URL,
            },
          }
        : {}),
    },
    elements,
    pages: shouldRestoreHeroImage
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
      : project.pages,
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

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
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
type TranslationPatch = { fontSize?: number; height?: number; text: string; width?: number; x?: number };

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
  const pageWidth = page?.width ?? Math.max(element.x + desiredWidth, originalCenter + desiredWidth / 2);
  const maxWidthAroundCenter = Math.max(1, 2 * Math.min(originalCenter, pageWidth - originalCenter));
  const nextWidth = Math.max(element.width, Math.min(desiredWidth, maxWidthAroundCenter));
  const nextX = Math.max(0, Math.min(pageWidth - nextWidth, originalCenter - nextWidth / 2));

  if (nextWidth >= desiredWidth) {
    return {
      text: normalizedText,
      width: nextWidth,
      x: nextX,
    };
  }

  const estimatedLineCount = Math.max(1, Math.ceil(estimatedWidth / Math.max(1, nextWidth - horizontalPadding)));
  return {
    text: normalizedText,
    width: nextWidth,
    x: nextX,
    height: Math.max(element.height, Math.ceil(estimatedLineCount * element.fontSize * 1.08)),
  };
}

export function useEditorViewModel(services: AppServices) {
  const initialProject = useMemo(() => normalizeProjectDocument(services.initialProject), [
    services.initialProject,
  ]);
  const shouldRestoreStoredProject = useMemo(
    () => !services.skipStoredProjectLoad && readPersistencePreference(),
    [services.skipStoredProjectLoad],
  );
  const [project, setProject] = useState<ProjectDocument>(initialProject);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('layout');
  const [modelStates, setModelStates] = useState<ModelState[]>([]);
  const [hasLoadedProject, setHasLoadedProject] = useState(!shouldRestoreStoredProject);
  const [persistenceEnabled, setPersistenceEnabled] = useState(shouldRestoreStoredProject);
  const [activePageId, setActivePageId] = useState(initialProject.pages[0]?.id ?? '');
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>(['image-hero']);
  const [history, setHistory] = useState<EditorHistory>({ past: [], future: [] });
  const [zoomPercent, setZoomPercent] = useState(100);
  const [backgroundSelectionMode, setBackgroundSelectionMode] = useState(false);
  const [backgroundSelectionNotice, setBackgroundSelectionNotice] = useState<string | undefined>();
  const [processingElementIds, setProcessingElementIds] = useState<string[]>([]);
  const [backgroundPreview, setBackgroundPreview] = useState<BackgroundPreviewState | undefined>();
  const [backgroundPreparation, setBackgroundPreparation] = useState<BackgroundPreparationState | undefined>();
  const [translationTargetLanguage, setTranslationTargetLanguageState] = useState(readTranslationTargetLanguage);
  const [translationTargetAttention, setTranslationTargetAttention] = useState(false);
  const [translationPreparation, setTranslationPreparation] = useState<TranslationPreparationState>({
    progress: 0,
    status: readTranslationTargetLanguage() ? 'ready' : 'idle',
  });
  const [promptPreparation, setPromptPreparation] = useState<PromptPreparationState>({
    availability: 'unavailable',
    progress: 0,
    status: 'idle',
  });
  const [promptApiAttention, setPromptApiAttention] = useState(false);
  const [promptApiNotice, setPromptApiNotice] = useState<string | undefined>();
  const [pageLanguageCodes, setPageLanguageCodes] = useState<Record<string, string>>({});
  const [elementClipboard, setElementClipboard] = useState<ElementClipboardState>({
    assets: {},
    elements: [],
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationNotice, setTranslationNotice] = useState<string | undefined>();
  const [, setBackgroundSelectionPoints] = useState<Record<string, BackgroundSelectionPoint[]>>(
    {},
  );
  const backgroundSelectionPointsRef = useRef<Record<string, BackgroundSelectionPoint[]>>({});
  const backgroundPreviewTimeoutRef = useRef<number | undefined>(undefined);
  const backgroundPreviewSequenceRef = useRef(0);
  const backgroundPreparationSequenceRef = useRef(0);
  const languageDetectionSequenceRef = useRef(0);
  const skipNextProjectSaveRef = useRef(shouldRestoreStoredProject);
  const selection = useMemo<SelectionState>(() => ({ pageId: activePageId, elementIds: selectedElementIds }), [
    activePageId,
    selectedElementIds,
  ]);
  const activeSlideLanguage = useMemo(() => {
    const option = getLanguageOption(pageLanguageCodes[activePageId]);
    return {
      code: option.code,
      displayCode: getLanguageDisplayCode(option.code),
      flag: option.flag,
      label: option.label,
    };
  }, [activePageId, pageLanguageCodes]);

  useEffect(() => {
    void services.modelSetupService.getModelStates().then(setModelStates);
  }, [services.modelSetupService]);

  useEffect(() => {
    let isMounted = true;
    void services.promptService.checkAvailability().then((availability) => {
      if (!isMounted) return;
      setPromptPreparation({
        availability,
        progress: availability === 'ready' ? 100 : 0,
        status: availability === 'ready' ? 'ready' : 'idle',
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
      .loadProject(services.storedProjectName ? { projectName: services.storedProjectName } : undefined)
      .then((savedProject) => {
        if (!isMounted) return;
        if (savedProject) {
          const normalizedProject = normalizeProjectDocument(savedProject);
          setProject(normalizedProject);
          setActivePageId(normalizedProject.pages[0]?.id ?? '');
          setPageLanguageCodes({});
          setSelectedElementIds(['image-hero'].filter((id) => Boolean(normalizedProject.elements[id])));
          writeProjectNameToUrl(normalizedProject.name);
        }
        setHasLoadedProject(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setPersistenceEnabled(false);
        setHasLoadedProject(true);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, 'false');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [persistenceEnabled, services.projectRepository, services.storedProjectName]);

  useEffect(() => {
    if (!hasLoadedProject || !persistenceEnabled) return;
    if (skipNextProjectSaveRef.current) {
      skipNextProjectSaveRef.current = false;
      return;
    }
    void services.projectRepository
      .saveProject(project)
      .then(() => {
        writeProjectNameToUrl(project.name);
      })
      .catch(() => {
        setPersistenceEnabled(false);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, 'false');
        }
      });
  }, [hasLoadedProject, persistenceEnabled, project, services.projectRepository]);

  useEffect(() => {
    if (pageLanguageCodes[activePageId]) return;
    const sampleText = getPageTextSample(project, activePageId);
    if (!sampleText) return;

    const sequence = languageDetectionSequenceRef.current + 1;
    languageDetectionSequenceRef.current = sequence;

    void services.translatorService
      .detectLanguage(sampleText)
      .then((languageCode) => {
        if (languageDetectionSequenceRef.current !== sequence) return;
        setPageLanguageCodes((current) => ({
          ...current,
          [activePageId]: normalizeLanguageCode(languageCode),
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

  function isBackgroundPreparationReady(elementId: string) {
    return backgroundPreparation?.elementId === elementId && backgroundPreparation.status === 'ready';
  }

  async function downloadRequiredModels() {
    setModelStates((currentStates) =>
      currentStates.map((state) =>
        state.required && state.status !== 'ready' ? { ...state, status: 'downloading', progress: 10 } : state,
      ),
    );
    const next = await services.modelSetupService.downloadRequiredModels();
    setModelStates(next);
    if (next.some((state) => state.id === IMAGE_EDITING_MODEL_ID && state.status === 'ready')) {
      setBackgroundSelectionNotice(undefined);
    }
  }

  async function downloadModel(id: string) {
    setModelStates((currentStates) =>
      currentStates.map((state) =>
        state.id === id && state.status !== 'ready' ? { ...state, status: 'downloading', progress: 10 } : state,
      ),
    );
    const next = await services.modelSetupService.downloadModel(id);
    setModelStates((currentStates) =>
      currentStates.map((state) => (state.id === id ? next : state)),
    );
    if (id === IMAGE_EDITING_MODEL_ID && next.status === 'ready') {
      setBackgroundSelectionNotice(undefined);
    }
  }

  async function refreshPromptApiAvailability() {
    const availability = await services.promptService.checkAvailability();
    setPromptPreparation((current) => ({
      availability,
      progress: availability === 'ready' ? 100 : current.progress,
      status: availability === 'ready' ? 'ready' : current.status === 'ready' ? 'idle' : current.status,
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
        onProgress: (progress) => {
          setPromptPreparation((current) => ({
            ...current,
            availability: progress >= 100 ? 'ready' : current.availability,
            progress: Math.max(4, Math.min(100, Math.round(progress))),
            status: progress >= 100 ? 'ready' : 'downloading',
          }));
        },
      });
      setPromptPreparation({ availability: 'ready', progress: 100, status: 'ready' });
      setPromptApiNotice('Prompt API ready');
    } catch (error) {
      setPromptPreparation({ availability: 'unavailable', progress: 0, status: 'failed' });
      setPromptApiAttention(true);
      setPromptApiNotice(error instanceof Error ? error.message : 'Chrome Prompt API could not be prepared.');
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

  function commitProject(
    updater: (currentProject: ProjectDocument) => ProjectDocument,
    options?: { activePageId?: string; selectedElementIds?: string[] },
  ) {
    setProject((currentProject) => {
      const nextProject = updater(currentProject);
      if (nextProject === currentProject) return currentProject;

      setHistory((currentHistory) => ({
        past: [...currentHistory.past, currentProject].slice(-50),
        future: [],
      }));

      if (options?.activePageId !== undefined) setActivePageId(options.activePageId);
      if (options?.selectedElementIds !== undefined) setSelectedElementIds(options.selectedElementIds);
      return nextProject;
    });
  }

  function getSelectionForProject(nextProject: ProjectDocument, pageId: string, currentSelection: string[]) {
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

  async function setPersistence(nextEnabled: boolean) {
    if (!nextEnabled) {
      setPersistenceEnabled(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, 'false');
      }
      return;
    }

    try {
      await services.projectRepository.saveProject(project);
      setPersistenceEnabled(true);
      writeProjectNameToUrl(project.name);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, 'true');
      }
    } catch {
      setPersistenceEnabled(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, 'false');
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
      setPersistenceEnabled(true);
      writeProjectNameToUrl(normalizedProject.name);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, 'true');
      }
    } catch {
      setPersistenceEnabled(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, 'false');
      }
    }
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
    const nextSelectedId = page.elementIds.at(-1);
    setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
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
                height: Math.max(patch.height, getMinimumTextHeight(element.text, element.fontSize)),
              }
          : patch;
      return new UpdateElementFrameCommand(elementId, nextPatch).execute(currentProject);
    });
  }

  function updateElementFrames(patches: Record<string, ElementFramePatch>) {
    commitProject((currentProject) => new UpdateElementFramesCommand(patches).execute(currentProject));
  }

  function updateTextContent(elementId: string, text: string) {
    commitProject((currentProject) => {
      const nextProject = new UpdateTextContentCommand(elementId, text).execute(currentProject);
      const element = nextProject.elements[elementId];
      if (!element || element.type !== 'text') return nextProject;
      const minimumHeight = getMinimumTextHeight(element.text, element.fontSize);
      if (element.height >= minimumHeight) return nextProject;
      return new UpdateElementFrameCommand(elementId, { height: minimumHeight }).execute(nextProject);
    });
  }

  function updateElementStyle(elementId: string, patch: ElementStylePatch) {
    commitProject((currentProject) => {
      const nextProject = new UpdateElementStyleCommand(elementId, patch).execute(currentProject);
      const element = nextProject.elements[elementId];
      if (!element || element.type !== 'text') return nextProject;
      const minimumHeight = getMinimumTextHeight(element.text, element.fontSize);
      if (element.height >= minimumHeight) return nextProject;
      return new UpdateElementFrameCommand(elementId, { height: minimumHeight }).execute(nextProject);
    });
  }

  function updatePageBackground(background: PageBackground) {
    commitProject((currentProject) =>
      new UpdatePageBackgroundCommand(activePageId, background).execute(currentProject),
    );
  }

  function getTranslatableTextElementIds(scope: TranslationScope, sourceProject = project) {
    const getVisibleUnlockedTextId = (elementId: string) => {
      const element = sourceProject.elements[elementId];
      if (!element || element.type !== 'text' || element.locked || element.visible === false) return undefined;
      return element.id;
    };

    if (scope === 'selection') {
      return selectedElementIds.map(getVisibleUnlockedTextId).filter((id): id is string => Boolean(id));
    }

    const pages =
      scope === 'slide'
        ? sourceProject.pages.filter((page) => page.id === activePageId)
        : sourceProject.pages;

    return pages.flatMap((page) =>
      page.elementIds.map(getVisibleUnlockedTextId).filter((id): id is string => Boolean(id)),
    );
  }

  async function translateTextScope(
    scope: TranslationScope,
    targetLanguage = 'pt',
    options?: { sourceLanguage?: string },
  ) {
    const elementIds = getTranslatableTextElementIds(scope);
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
        return [elementId, fitTranslatedTextToOriginalFrame(element, translatedText, page)] as const;
      }),
    );
    const translations = Object.fromEntries(
      translatedEntries.filter((entry): entry is readonly [string, TranslationPatch] =>
        Boolean(entry),
      ),
    );

    commitProject((currentProject) => new TranslateTextElementsCommand(translations).execute(currentProject));
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
    const nextLanguage = TRANSLATION_LANGUAGE_OPTIONS.some((option) => option.code === languageCode)
      ? languageCode
      : '';
    setTranslationTargetLanguageState(nextLanguage);
    setTranslationTargetAttention(false);
    setTranslationNotice(undefined);
    if (typeof window !== 'undefined') {
      if (nextLanguage) {
        window.localStorage.setItem(TRANSLATION_TARGET_LANGUAGE_KEY, nextLanguage);
      } else {
        window.localStorage.removeItem(TRANSLATION_TARGET_LANGUAGE_KEY);
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
      const sourceLanguage = normalizeLanguageCode(await services.translatorService.detectLanguage(sampleText));
      setTranslationPreparation({ progress: 8, sourceLanguage, status: 'downloading' });
      await services.translatorService.prepareTranslation(sourceLanguage, nextLanguage, {
        onProgress: (progress) => {
          setTranslationPreparation({
            progress: Math.max(8, Math.min(100, Math.round(progress))),
            sourceLanguage,
            status: progress >= 100 ? 'ready' : 'downloading',
          });
        },
      });
      setTranslationPreparation({ progress: 100, sourceLanguage, status: 'ready' });
    } catch (error) {
      setTranslationPreparation({ progress: 0, status: 'failed' });
      setTranslationNotice(error instanceof Error ? error.message : 'Translation language could not be prepared.');
    }
  }

  async function requestTranslation(scope: TranslationScope) {
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
      const translatedPageIds = await translateTextScope(
        scope,
        translationTargetLanguage,
        translationPreparation.sourceLanguage
          ? { sourceLanguage: translationPreparation.sourceLanguage }
          : undefined,
      );
      if (translatedPageIds.length > 0) {
        const normalizedTargetLanguage = normalizeLanguageCode(translationTargetLanguage);
        setPageLanguageCodes((current) => ({
          ...current,
          ...Object.fromEntries(translatedPageIds.map((pageId) => [pageId, normalizedTargetLanguage])),
        }));
      }
    } catch (error) {
      setTranslationNotice(error instanceof Error ? error.message : 'Translation could not be completed.');
    } finally {
      setIsTranslating(false);
    }
  }

  function setElementVisibility(elementId: string, visible: boolean) {
    commitProject((currentProject) =>
      new SetElementVisibilityCommand(elementId, visible).execute(currentProject),
    );
  }

  function setElementLock(elementId: string, locked: boolean) {
    commitProject((currentProject) => new SetElementLockCommand(elementId, locked).execute(currentProject));
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
      if (element.type !== 'image') continue;
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
      id: createId(`${element.id}-copy`),
      x: element.x + PASTED_ELEMENT_OFFSET,
      y: element.y + PASTED_ELEMENT_OFFSET,
      locked: false,
    }));

    commitProject(
      (currentProject) =>
        new AddElementsCommand(activePageId, pastedElements, elementClipboard.assets).execute(currentProject),
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
      const nextProject = new DeleteElementCommand(activePageId, elementId).execute(currentProject);
      const nextPage = nextProject.pages.find((page) => page.id === activePageId);
      if (selectedElementIds.includes(elementId)) {
        const nextSelectedId = nextPage?.elementIds.at(-1);
        setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
      }
      return nextProject;
    });
  }

  function deleteSelectedElement() {
    const deletableElementIds = selectedElementIds.filter((elementId) => !processingElementIds.includes(elementId));
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
          new DeleteElementCommand(activePageId, elementId).execute(nextProjectState),
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
    const nextElementId = createId(`${elementId}-copy`);
    commitProject(
      (currentProject) =>
        new DuplicateElementCommand(activePageId, elementId, nextElementId).execute(currentProject),
      { selectedElementIds: [nextElementId] },
    );
  }

  function insertTextElement() {
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;
    const selectedElement = project.elements[selectedElementIds[0] ?? ''];
    const templateTextElement =
      project.elements['text-title']?.type === 'text'
        ? project.elements['text-title']
        : Object.values(project.elements).find(
            (element) => element.type === 'text' && element.fontFamily === 'Orbitron',
          );
    const width = templateTextElement?.type === 'text' ? templateTextElement.width : 600;
    const height = templateTextElement?.type === 'text' ? templateTextElement.height : 240;
    const elementId = createId('text');
    const nextElement: DesignElement = {
      id: elementId,
      type: 'text',
      text: templateTextElement?.type === 'text' ? templateTextElement.text : 'AI Design Revolution',
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
      fontFamily: templateTextElement?.type === 'text' ? templateTextElement.fontFamily : 'Orbitron',
      fontSize: templateTextElement?.type === 'text' ? templateTextElement.fontSize : 96,
      fontWeight: templateTextElement?.type === 'text' ? templateTextElement.fontWeight : 800,
      fill: templateTextElement?.type === 'text' ? templateTextElement.fill : '#37FD76',
      align: templateTextElement?.type === 'text' ? templateTextElement.align : 'center',
    };

    commitProject(
      (currentProject) => new AddElementsCommand(activePageId, [nextElement]).execute(currentProject),
      { selectedElementIds: [elementId] },
    );
  }

  function alignSelectedElement(mode: AlignMode) {
    const elementId = selectedElementIds[0];
    if (!elementId) return;
    commitProject((currentProject) => new AlignElementCommand(activePageId, elementId, mode).execute(currentProject));
  }

  function setSelectedElementZOrder(mode: ZOrderMode) {
    const elementId = selectedElementIds[0];
    if (!elementId) return;
    commitProject((currentProject) => new SetZOrderCommand(activePageId, elementId, mode).execute(currentProject));
  }

  function reorderElement(elementId: string, targetElementId: string) {
    commitProject((currentProject) => {
      const page = currentProject.pages.find((item) => item.id === activePageId);
      if (!page) return currentProject;

      const displayOrder = [...page.elementIds].reverse().filter((id) => id !== elementId);
      const targetDisplayIndex = displayOrder.indexOf(targetElementId);
      if (targetDisplayIndex < 0) return currentProject;
      displayOrder.splice(targetDisplayIndex, 0, elementId);
      const nextPageOrder = [...displayOrder].reverse();
      const targetPageIndex = nextPageOrder.indexOf(elementId);
      return new ReorderElementCommand(activePageId, elementId, targetPageIndex).execute(currentProject);
    });
  }

  function addPage() {
    const sourcePage = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!sourcePage) return;
    const pageId = createId('page');
    const nextPage: Page = {
      id: pageId,
      name: `Slide ${project.pages.length + 1}`,
      width: sourcePage.width,
      height: sourcePage.height,
      background: sourcePage.background,
      elementIds: [],
    };

    commitProject(
      (currentProject) => ({
        ...currentProject,
        pages: [...currentProject.pages, nextPage],
        updatedAt: new Date().toISOString(),
      }),
      { activePageId: pageId, selectedElementIds: [] },
    );
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
      : previousProject.pages[0]?.id ?? '';
    setActivePageId(nextActivePageId);
    setSelectedElementIds(getSelectionForProject(previousProject, nextActivePageId, selectedElementIds));
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
      : nextProject.pages[0]?.id ?? '';
    setActivePageId(nextActivePageId);
    setSelectedElementIds(getSelectionForProject(nextProject, nextActivePageId, selectedElementIds));
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

    const imageEditingModel = modelStates.find((state) => state.id === IMAGE_EDITING_MODEL_ID);
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
        ...(shouldKeepCurrentPreview && currentPreview.maskUrl ? { maskUrl: currentPreview.maskUrl } : {}),
        ...(shouldKeepCurrentPreview && currentPreview.score !== undefined ? { score: currentPreview.score } : {}),
      };
    });

    backgroundPreviewTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await services.backgroundRemovalService.previewBackgroundMask(asset, { points });
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
            currentPreview?.elementId === elementId ? { ...currentPreview, pending: false } : currentPreview,
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
        ...(shouldKeepCurrentPreview && currentPreview.maskUrl ? { maskUrl: currentPreview.maskUrl } : {}),
        ...(shouldKeepCurrentPreview && currentPreview.score !== undefined ? { score: currentPreview.score } : {}),
      };
    });

    void (async () => {
      try {
        const result = await services.backgroundRemovalService.previewBackgroundMask(asset, { points });
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
    const imageSize = await readImageSize(dataUrl);
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    const assetId = createId('asset');
    const elementId = createId('image');
    const imageName = file.name.trim() || 'Pasted image';
    const fittedImage = fitImageWithinPage({
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      pageWidth: page.width,
      pageHeight: page.height,
    });

    commitProject(
      (currentProject) =>
      new AddImageElementCommand(activePageId, {
        asset: {
          id: assetId,
          type: 'image',
          name: imageName,
          mimeType: file.type || 'image/*',
          objectUrl: dataUrl,
        },
        element: {
          id: elementId,
          type: 'image',
          assetId,
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
  }

  return {
    project,
    activePageId,
    zoomPercent,
    persistenceEnabled,
    backgroundSelectionMode,
    backgroundSelectionNotice,
    processingElementIds,
    backgroundPreview,
    backgroundPreparation,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    selection,
    activeTab,
    activeSlideLanguage,
    setActiveTab,
    modelStates,
    setProjectName,
    setPersistence,
    importProject,
    translationLanguageOptions: TRANSLATION_LANGUAGE_OPTIONS,
    translationTargetLanguage,
    translationTargetAttention,
    translationPreparation,
    isTranslating,
    translationNotice,
    promptPreparation,
    promptApiAttention,
    promptApiNotice,
    preparePromptApi,
    ensurePromptApiReadyForPrompt,
    setTranslationTargetLanguage,
    canTranslateSelection: !isTranslating && getTranslatableTextElementIds('selection').length > 0,
    canTranslateCurrentSlide: !isTranslating && getTranslatableTextElementIds('slide').length > 0,
    canTranslateDeck: !isTranslating && getTranslatableTextElementIds('deck').length > 0,
    canPasteElements: elementClipboard.elements.length > 0,
    translateSelectedText: () => requestTranslation('selection'),
    translateCurrentSlide: () => requestTranslation('slide'),
    translateDeck: () => requestTranslation('deck'),
    downloadRequiredModels,
    downloadModel,
    selectElement,
    selectAllElementsOnActivePage,
    clearSelection,
    selectPage,
    addPage,
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
    alignSelectedElement,
    setSelectedElementZOrder,
    updateElementFrame,
    updateElementFrames,
    updateElementStyle,
    updatePageBackground,
    updateTextContent,
    setElementVisibility,
    setElementLock,
    deleteElement,
    reorderElement,
    importImageFile,
  };
}
