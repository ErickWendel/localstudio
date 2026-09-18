import type { DesignElement, ProjectDocument } from '../../../domain/documents/model';
import { sampleProject } from '../../../domain/projects/sampleProject';

function getMaterializedLayoutElementId(pageId: string, elementId: string) {
  return `${pageId}-layout-${elementId}`;
}

function materializeLayoutElements(
  project: ProjectDocument,
  elements: ProjectDocument['elements'],
) {
  return project.pages.map((page) => {
    const layout = page.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
    if (!layout) return page;

    const pageElements = page.elementIds
      .map((elementId) => elements[elementId])
      .filter((element): element is DesignElement => Boolean(element));
    const layoutElementIds = layout.elementIds.flatMap((layoutElementId) => {
      const layoutElement = layout.elements[layoutElementId];
      if (!layoutElement || layoutElement.visible === false) return [];
      if (
        layoutElement.placeholderRole &&
        pageElements.some((element) => element.placeholderRole === layoutElement.placeholderRole)
      ) {
        return [];
      }

      const materializedId = getMaterializedLayoutElementId(page.id, layoutElement.id);
      if (!elements[materializedId]) {
        const { templateSource, ...editableLayoutElement } = layoutElement;
        void templateSource;
        elements[materializedId] = {
          ...editableLayoutElement,
          id: materializedId,
          locked: false,
        };
      }
      return [materializedId];
    });

    const newLayoutElementIds = layoutElementIds.filter(
      (elementId) => !page.elementIds.includes(elementId),
    );
    if (newLayoutElementIds.length === 0) return page;
    const elementIds = [...newLayoutElementIds, ...page.elementIds];
    return { ...page, elementIds };
  });
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

  const pages = (
    shouldRestoreHeroImage
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
  }));

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
    pages: materializeLayoutElements({ ...project, pages }, elements),
  };
}

export const editorViewModelProject = {
  normalizeProjectDocument,
  writeProjectNameToUrl,
};
