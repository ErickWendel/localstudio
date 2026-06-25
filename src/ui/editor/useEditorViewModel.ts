import { useEffect, useMemo, useState } from 'react';
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

export type RightPanelTab = 'layout' | 'design' | 'ai-tools';

interface EditorHistory {
  past: ProjectDocument[];
  future: ProjectDocument[];
}

const PERSISTENCE_PREFERENCE_KEY = 'ew-canvas-ai.persistence-enabled';

function readPersistencePreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PERSISTENCE_PREFERENCE_KEY) === 'true';
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

export function useEditorViewModel(services: AppServices) {
  const initialProject = useMemo(() => normalizeProjectDocument(services.initialProject), [
    services.initialProject,
  ]);
  const [project, setProject] = useState<ProjectDocument>(initialProject);
  const [activeTab, setActiveTab] = useState<RightPanelTab>('layout');
  const [modelStates, setModelStates] = useState<ModelState[]>([]);
  const [hasLoadedProject, setHasLoadedProject] = useState(true);
  const [persistenceEnabled, setPersistenceEnabled] = useState(readPersistencePreference);
  const [activePageId, setActivePageId] = useState(initialProject.pages[0]?.id ?? '');
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>(['image-hero']);
  const [history, setHistory] = useState<EditorHistory>({ past: [], future: [] });
  const [zoomPercent, setZoomPercent] = useState(100);
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

    void services.projectRepository.loadProject().then((savedProject) => {
      if (!isMounted) return;
      if (savedProject) {
        const normalizedProject = normalizeProjectDocument(savedProject);
        setProject(normalizedProject);
        setActivePageId(normalizedProject.pages[0]?.id ?? '');
        setSelectedElementIds(['image-hero'].filter((id) => Boolean(normalizedProject.elements[id])));
      }
      setHasLoadedProject(true);
    });

    return () => {
      isMounted = false;
    };
  }, [persistenceEnabled, services.projectRepository]);

  useEffect(() => {
    if (!hasLoadedProject || !persistenceEnabled) return;
    void services.projectRepository.saveProject(project);
  }, [hasLoadedProject, persistenceEnabled, project, services.projectRepository]);

  async function downloadRequiredModels() {
    const next = await services.modelSetupService.downloadRequiredModels();
    setModelStates(next);
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

  function setPersistence(nextEnabled: boolean) {
    setPersistenceEnabled(nextEnabled);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PERSISTENCE_PREFERENCE_KEY, String(nextEnabled));
    }
    if (nextEnabled) {
      void services.projectRepository.saveProject(project);
    }
  }

  function selectPage(pageId: string) {
    const page = project.pages.find((item) => item.id === pageId);
    if (!page) return;
    setActivePageId(page.id);
    const nextSelectedId = page.elementIds.at(-1);
    setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
  }

  function updateElementFrame(elementId: string, patch: ElementFramePatch) {
    commitProject((currentProject) => new UpdateElementFrameCommand(elementId, patch).execute(currentProject));
  }

  function updateTextContent(elementId: string, text: string) {
    commitProject((currentProject) => new UpdateTextContentCommand(elementId, text).execute(currentProject));
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
    deleteElement(elementId);
  }

  function duplicateSelectedElement() {
    const elementId = selectedElementIds[0];
    if (!elementId) return;
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

  async function importImageFile(file: File) {
    const dataUrl = await readImageFileAsDataUrl(file);
    const imageSize = await readImageSize(dataUrl);
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    const assetId = createId('asset');
    const elementId = createId('image');
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
          name: file.name,
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
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    selection,
    activeTab,
    setActiveTab,
    modelStates,
    setProjectName,
    setPersistence,
    downloadRequiredModels,
    selectElement,
    selectPage,
    addPage,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
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
