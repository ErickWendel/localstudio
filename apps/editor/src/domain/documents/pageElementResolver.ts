import type { DesignElement, Page, ProjectDocument } from './model';

function isVisibleElement(element: DesignElement | undefined): element is DesignElement {
  return Boolean(element && element.visible !== false);
}

function getLayoutElements(project: ProjectDocument, page: Page) {
  const layout = page.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
  return (
    layout?.elementIds
      .map((elementId) => layout.elements[elementId])
      .filter(isVisibleElement)
      .filter((element) => !element.placeholderRole) ?? []
  );
}

function getPageElements(project: ProjectDocument, page: Page) {
  return page.elementIds.map((elementId) => project.elements[elementId]).filter(isVisibleElement);
}

export const pageElementResolver = {
  getLayoutElements,
  getPageElements,
  getVisibleElements(project: ProjectDocument, page: Page) {
    return [...getLayoutElements(project, page), ...getPageElements(project, page)];
  },
};
