import type { ProjectDocument } from '../../domain/documents/model';

function hashAuthoringValue(prefix: string, value: unknown) {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16)}`;
}

function getPresentation(project: ProjectDocument) {
  return hashAuthoringValue('presentation', project);
}

function getSlide(project: ProjectDocument, pageId: string) {
  const page = project.pages.find((candidate) => candidate.id === pageId);
  if (!page) return '';
  const layout = page.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
  const pageElements = page.elementIds.map((elementId) => project.elements[elementId]);
  const layoutElements = layout?.elementIds.map((elementId) => layout.elements[elementId]) ?? [];
  const elements = [...layoutElements, ...pageElements];
  const assetIds = new Set<string>();
  if (page.background.type === 'asset') assetIds.add(page.background.assetId);
  if (layout?.background.type === 'asset') assetIds.add(layout.background.assetId);
  elements.forEach((element) => {
    if (element && 'assetId' in element && typeof element.assetId === 'string') {
      assetIds.add(element.assetId);
    }
  });
  return hashAuthoringValue('slide', {
    page: {
      name: page.name,
      width: page.width,
      height: page.height,
      background: page.background,
      elementIds: page.elementIds,
      transition: page.transition,
      animationBuilds: page.animationBuilds,
      layoutId: page.layoutId,
      speakerNotes: page.speakerNotes,
      visible: page.visible,
    },
    layout,
    elements,
    assets: [...assetIds].sort().map((assetId) => project.assets[assetId]),
    fonts: project.fonts,
    theme: project.themeId ? project.themes?.[project.themeId] : undefined,
  });
}

export const authoringRevision = { getPresentation, getSlide };
