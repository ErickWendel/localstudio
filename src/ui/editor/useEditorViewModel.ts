import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppServices } from '../../app/composition';
import {
  AddImageElementCommand,
  AlignElementCommand,
  DeleteElementCommand,
  DuplicateElementCommand,
  ReorderElementCommand,
  SetElementLockCommand,
  SetElementVisibilityCommand,
  SetZOrderCommand,
  UpdateElementFrameCommand,
  UpdateTextContentCommand,
  type AlignMode,
  type ElementFramePatch,
  type ZOrderMode,
} from '../../domain/commands/basicCommands';
import { fitImageWithinPage } from '../../domain/imageSizing';
import type { Page, ProjectDocument, SelectionState } from '../../domain/model';
import { SAMPLE_HERO_IMAGE_SIZE, SAMPLE_HERO_IMAGE_URL } from '../../domain/sampleProject';
import type { ModelState } from '../../services/interfaces';
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

const PERSISTENCE_PREFERENCE_KEY = 'ew-canvas-ai.persistence-enabled';
const IMAGE_EDITING_MODEL_REQUIRED_MESSAGE = 'You must download the image editing tools first.';
const BACKGROUND_PREVIEW_DEBOUNCE_MS = 120;

function readPersistencePreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PERSISTENCE_PREFERENCE_KEY) === 'true';
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
              objectUrl: SAMPLE_HERO_IMAGE_URL,
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
  const [, setBackgroundSelectionPoints] = useState<Record<string, BackgroundSelectionPoint[]>>(
    {},
  );
  const backgroundSelectionPointsRef = useRef<Record<string, BackgroundSelectionPoint[]>>({});
  const backgroundPreviewTimeoutRef = useRef<number | undefined>(undefined);
  const backgroundPreviewSequenceRef = useRef(0);
  const backgroundPreparationSequenceRef = useRef(0);
  const skipNextProjectSaveRef = useRef(shouldRestoreStoredProject);
  const selection = useMemo<SelectionState>(() => ({ pageId: activePageId, elementIds: selectedElementIds }), [
    activePageId,
    selectedElementIds,
  ]);

  useEffect(() => {
    void services.modelSetupService.getModelStates().then(setModelStates);
  }, [services.modelSetupService]);

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

  function selectElement(elementId: string) {
    if (processingElementIds.includes(elementId)) return;
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints();
    setSelectedElementIds([elementId]);
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

  function setElementVisibility(elementId: string, visible: boolean) {
    commitProject((currentProject) =>
      new SetElementVisibilityCommand(elementId, visible).execute(currentProject),
    );
  }

  function setElementLock(elementId: string, locked: boolean) {
    commitProject((currentProject) => new SetElementLockCommand(elementId, locked).execute(currentProject));
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
    const elementId = selectedElementIds[0];
    if (!elementId) return;
    if (processingElementIds.includes(elementId)) return;
    setBackgroundSelectionMode(false);
    setBackgroundSelectionNotice(undefined);
    clearBackgroundPreview();
    clearBackgroundPreparation();
    clearBackgroundSelectionPoints(elementId);
    deleteElement(elementId);
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
    setActiveTab,
    modelStates,
    setProjectName,
    setPersistence,
    importProject,
    downloadRequiredModels,
    downloadModel,
    selectElement,
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
    alignSelectedElement,
    setSelectedElementZOrder,
    updateElementFrame,
    updateTextContent,
    setElementVisibility,
    setElementLock,
    deleteElement,
    reorderElement,
    importImageFile,
  };
}
