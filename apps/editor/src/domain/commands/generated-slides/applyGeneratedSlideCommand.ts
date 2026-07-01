import { placeholderImage } from '../../assets/placeholderImage';
import type { Asset, DesignElement, ProjectDocument } from '../../model';
import type { GeneratedSlideElement, GeneratedSlideTasksDocument } from '../../generated-slides/generatedSlide';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../types';

function generatedElementId(pageId: string, id: string) {
  return `generated-${pageId}-${id.replace(/[^a-z0-9-_]/gi, '-').toLowerCase()}`;
}

function remoteAssetId(url: string) {
  return `asset-remote-${btoa(url).replace(/[^a-z0-9]/gi, '').slice(0, 16).toLowerCase()}`;
}

function toDesignElement(pageId: string, element: GeneratedSlideElement): DesignElement {
  const base = {
    id: generatedElementId(pageId, element.id),
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    locked: false,
    visible: true,
    opacity: element.opacity,
  };

  if (element.type === 'text') {
    return {
      ...base,
      type: 'text',
      text: element.text,
      fontFamily: element.fontFamily,
      fontSize: element.fontSize,
      fontWeight: element.fontWeight,
      fill: element.fill,
      align: element.align,
    };
  }

  if (element.type === 'image') {
    return {
      ...base,
      type: 'image',
      assetId: element.assetRole === 'remote' && element.src ? remoteAssetId(element.src) : placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID,
    };
  }

  return {
    ...base,
    type: 'shape',
    shape: element.shape,
    fill: element.fill,
    ...(element.stroke ? { stroke: element.stroke } : {}),
    ...(element.strokeWidth !== undefined ? { strokeWidth: element.strokeWidth } : {}),
  };
}

const placeholderAsset: Asset = {
  id: placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID,
  type: 'image',
  name: placeholderImage.PLACEHOLDER_IMAGE_NAME,
  mimeType: placeholderImage.PLACEHOLDER_IMAGE_MIME_TYPE,
  objectUrl: placeholderImage.PLACEHOLDER_IMAGE_URL,
  storage: 'inline',
};

function toRemoteAsset(element: GeneratedSlideElement): Asset | undefined {
  if (element.type !== 'image' || element.assetRole !== 'remote' || !element.src) return undefined;
  return {
    id: remoteAssetId(element.src),
    type: 'image',
    name: 'Remote prompt image',
    mimeType: 'image/*',
    objectUrl: element.src,
    storage: 'remote',
  };
}

class PrepareGeneratedSlideCommand implements EditorCommand {
  readonly description = 'Prepare generated slide';

  constructor(
    private readonly pageId: string,
    private readonly page: GeneratedSlideTasksDocument['page'],
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;

    const oldElementIds = new Set(page.elementIds);
    const remainingElements = Object.fromEntries(
      Object.entries(project.elements).filter(([elementId]) => !oldElementIds.has(elementId)),
    );

    return {
      ...project,
      elements: remainingElements,
      pages: project.pages.map((item) =>
        item.id === this.pageId
          ? {
              ...item,
              name: this.page.name,
              background: this.page.background,
              elementIds: [],
            }
          : item,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class AddGeneratedSlideElementCommand implements EditorCommand {
  readonly description = 'Add generated slide element';

  constructor(
    private readonly pageId: string,
    private readonly element: GeneratedSlideElement,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;

    const designElement = toDesignElement(this.pageId, this.element);
    const needsPlaceholderAsset = this.element.type === 'image' && this.element.assetRole === 'placeholder';
    const remoteAsset = toRemoteAsset(this.element);

    return {
      ...project,
      assets: {
        ...project.assets,
        ...(needsPlaceholderAsset ? { [placeholderImage.PLACEHOLDER_IMAGE_ASSET_ID]: placeholderAsset } : {}),
        ...(remoteAsset ? { [remoteAsset.id]: remoteAsset } : {}),
      },
      elements: {
        ...project.elements,
        [designElement.id]: designElement,
      },
      pages: project.pages.map((item) =>
        item.id === this.pageId
          ? {
              ...item,
              elementIds: [...item.elementIds.filter((elementId) => elementId !== designElement.id), designElement.id],
            }
          : item,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const applyGeneratedSlideCommand = {
  PrepareGeneratedSlideCommand,
  AddGeneratedSlideElementCommand,
};
