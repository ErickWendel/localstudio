import type { ProjectDocument } from '../../../domain/documents/model';
import { sampleProject } from '../../../domain/projects/sampleProject';

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

export const editorViewModelProject = {
  normalizeProjectDocument,
  writeProjectNameToUrl,
};
