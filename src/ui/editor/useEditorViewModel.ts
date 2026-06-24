import { useEffect, useMemo, useState } from 'react';
import type { AppServices } from '../../app/composition';
import {
  AddImageElementCommand,
  DeleteElementCommand,
  ReorderElementCommand,
  SetElementLockCommand,
  SetElementVisibilityCommand,
  UpdateElementFrameCommand,
  UpdateTextContentCommand,
  type ElementFramePatch,
} from '../../domain/commands/basicCommands';
import { fitImageWithinPage } from '../../domain/imageSizing';
import type { ProjectDocument, SelectionState } from '../../domain/model';
import { SAMPLE_HERO_IMAGE_SIZE, SAMPLE_HERO_IMAGE_URL } from '../../domain/sampleProject';
import type { ModelState } from '../../services/interfaces';

export type RightPanelTab = 'layout' | 'design' | 'ai-tools';

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
                  const backgroundIndex = nextElementIds.indexOf('shape-bg');
                  nextElementIds.splice(backgroundIndex >= 0 ? backgroundIndex + 1 : nextElementIds.length, 0, 'image-hero');
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
  const [project, setProject] = useState<ProjectDocument>(
    normalizeProjectDocument(services.initialProject),
  );
  const [activeTab, setActiveTab] = useState<RightPanelTab>('layout');
  const [modelStates, setModelStates] = useState<ModelState[]>([]);
  const [hasLoadedProject, setHasLoadedProject] = useState(false);
  const activePageId = project.pages[0]?.id ?? '';
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>(['image-hero']);
  const selection = useMemo<SelectionState>(() => ({ pageId: activePageId, elementIds: selectedElementIds }), [
    activePageId,
    selectedElementIds,
  ]);

  useEffect(() => {
    void services.modelSetupService.getModelStates().then(setModelStates);
  }, [services.modelSetupService]);

  useEffect(() => {
    let isMounted = true;

    void services.projectRepository.loadProject().then((savedProject) => {
      if (!isMounted) return;
      if (savedProject) setProject(normalizeProjectDocument(savedProject));
      setHasLoadedProject(true);
    });

    return () => {
      isMounted = false;
    };
  }, [services.projectRepository]);

  useEffect(() => {
    if (!hasLoadedProject) return;
    void services.projectRepository.saveProject(project);
  }, [hasLoadedProject, project, services.projectRepository]);

  async function downloadRequiredModels() {
    const next = await services.modelSetupService.downloadRequiredModels();
    setModelStates(next);
  }

  function selectElement(elementId: string) {
    setSelectedElementIds([elementId]);
  }

  function updateElementFrame(elementId: string, patch: ElementFramePatch) {
    setProject((currentProject) => new UpdateElementFrameCommand(elementId, patch).execute(currentProject));
  }

  function updateTextContent(elementId: string, text: string) {
    setProject((currentProject) => new UpdateTextContentCommand(elementId, text).execute(currentProject));
  }

  function setElementVisibility(elementId: string, visible: boolean) {
    setProject((currentProject) =>
      new SetElementVisibilityCommand(elementId, visible).execute(currentProject),
    );
  }

  function setElementLock(elementId: string, locked: boolean) {
    setProject((currentProject) => new SetElementLockCommand(elementId, locked).execute(currentProject));
  }

  function deleteElement(elementId: string) {
    setProject((currentProject) => {
      const nextProject = new DeleteElementCommand(activePageId, elementId).execute(currentProject);
      const nextPage = nextProject.pages.find((page) => page.id === activePageId);
      if (selectedElementIds.includes(elementId)) {
        const nextSelectedId = nextPage?.elementIds.at(-1);
        setSelectedElementIds(nextSelectedId ? [nextSelectedId] : []);
      }
      return nextProject;
    });
  }

  function reorderElement(elementId: string, targetElementId: string) {
    setProject((currentProject) => {
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

    setProject((currentProject) =>
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
    );
    setSelectedElementIds([elementId]);
  }

  return {
    project,
    activePageId,
    selection,
    activeTab,
    setActiveTab,
    modelStates,
    downloadRequiredModels,
    selectElement,
    updateElementFrame,
    updateTextContent,
    setElementVisibility,
    setElementLock,
    deleteElement,
    reorderElement,
    importImageFile,
  };
}
