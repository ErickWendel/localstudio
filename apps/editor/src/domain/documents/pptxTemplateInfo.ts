import type { DesignElement, ProjectDocument } from './model';

function isImportedTemplateInfo(element: DesignElement | undefined): element is DesignElement {
  return Boolean(
    element?.placeholderRole &&
      element.importSource?.format === 'pptx' &&
      element.importSource.source !== 'slide',
  );
}

function getDeckElements(project: ProjectDocument) {
  const deckElementIds = new Set(project.pages.flatMap((page) => page.elementIds));
  return Array.from(deckElementIds)
    .map((elementId) => project.elements[elementId])
    .filter(isImportedTemplateInfo);
}

export const pptxTemplateInfo = {
  getDeckElements,
  isElement: isImportedTemplateInfo,
  hasDeckElements(project: ProjectDocument) {
    return getDeckElements(project).length > 0;
  },
  isDeckVisible(project: ProjectDocument) {
    return getDeckElements(project).some((element) => element.visible !== false);
  },
};
