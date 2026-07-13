import type { Page, ProjectDocument } from './model';

function isVisible(page: Page) {
  return page.visible !== false;
}

function getVisiblePages(project: ProjectDocument) {
  return project.pages.filter(isVisible);
}

function getVisiblePage(project: ProjectDocument, pageId: string) {
  return project.pages.find((page) => page.id === pageId && isVisible(page));
}

function getFirstVisiblePage(project: ProjectDocument) {
  return getVisiblePages(project)[0];
}

function getVisiblePageIndex(project: ProjectDocument, pageId: string) {
  return getVisiblePages(project).findIndex((page) => page.id === pageId);
}

function getNearestVisiblePage(project: ProjectDocument, pageId: string, direction: -1 | 1 = 1) {
  const page = getVisiblePage(project, pageId);
  if (page) return page;

  const sourceIndex = project.pages.findIndex((item) => item.id === pageId);
  const startIndex = sourceIndex < 0 ? 0 : sourceIndex + direction;
  for (
    let index = startIndex;
    index >= 0 && index < project.pages.length;
    index += direction
  ) {
    const candidate = project.pages[index];
    if (candidate && isVisible(candidate)) return candidate;
  }

  return getFirstVisiblePage(project);
}

function getRelativeVisiblePage(project: ProjectDocument, pageId: string, offset: -1 | 1) {
  const visiblePages = getVisiblePages(project);
  const visibleIndex = visiblePages.findIndex((page) => page.id === pageId);
  if (visibleIndex >= 0) return visiblePages[visibleIndex + offset];
  return getNearestVisiblePage(project, pageId, offset);
}

export const pageVisibility = {
  getFirstVisiblePage,
  getNearestVisiblePage,
  getRelativeVisiblePage,
  getVisiblePageIndex,
  getVisiblePages,
  isVisible,
};
