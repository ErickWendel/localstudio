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
import type { ProjectDocument, SelectionState } from '../../domain/model';
import { SAMPLE_HERO_IMAGE_URL } from '../../domain/sampleProject';
import type { ModelState } from '../../services/interfaces';

export type RightPanelTab = 'layout' | 'design' | 'ai-tools';

function normalizeProjectDocument(project: ProjectDocument): ProjectDocument {
  const shouldRestoreHeroImage = Boolean(project.assets['asset-hero']) && !project.elements['image-hero'];
  const pageId = project.pages[0]?.id;
  const elements: ProjectDocument['elements'] = {};

  for (const [id, element] of Object.entries(project.elements)) {
    elements[id] = { ...element, visible: element.visible ?? true };
  }

  if (shouldRestoreHeroImage) {
    elements['image-hero'] = {
      id: 'image-hero',
      type: 'image',
      assetId: 'asset-hero',
      x: 360,
      y: 210,
      width: 1200,
      height: 650,
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
    const page = project.pages.find((item) => item.id === activePageId) ?? project.pages[0];
    if (!page) return;

    const assetId = createId('asset');
    const elementId = createId('image');
    const imageWidth = Math.round(page.width * 0.5);
    const imageHeight = Math.round(page.height * 0.5);

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
          x: Math.round((page.width - imageWidth) / 2),
          y: Math.round((page.height - imageHeight) / 2),
          width: imageWidth,
          height: imageHeight,
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
