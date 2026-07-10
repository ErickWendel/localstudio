import type { Page, ProjectDocument } from '../../../domain/documents/model';

function getSourcePage(input: {
  activePageId: string;
  afterPageId: string;
  project: ProjectDocument;
}) {
  return (
    input.project.pages.find((page) => page.id === input.afterPageId) ??
    input.project.pages.find((page) => page.id === input.activePageId) ??
    input.project.pages[0]
  );
}

function createInsertedPage(input: {
  activePageId: string;
  afterPageId: string;
  pageId: string;
  project: ProjectDocument;
}) {
  const sourcePage = getSourcePage(input);
  if (!sourcePage) return undefined;
  return {
    id: input.pageId,
    name: `Slide ${input.project.pages.length + 1}`,
    width: sourcePage.width,
    height: sourcePage.height,
    background: sourcePage.background,
    elementIds: [],
  } satisfies Page;
}

function insertPageAfter(project: ProjectDocument, afterPageId: string, page: Page) {
  const afterIndex = project.pages.findIndex((item) => item.id === afterPageId);
  const insertIndex = afterIndex >= 0 ? afterIndex + 1 : project.pages.length;
  const pages = [...project.pages];
  pages.splice(insertIndex, 0, page);
  return {
    ...project,
    pages,
    updatedAt: new Date().toISOString(),
  };
}

function getNextPageIdAfterDelete(project: ProjectDocument, pageId: string) {
  if (project.pages.length <= 1) return undefined;
  const pageIndex = project.pages.findIndex((page) => page.id === pageId);
  if (pageIndex < 0) return undefined;
  return (
    project.pages[pageIndex + 1]?.id ??
    project.pages[pageIndex - 1]?.id ??
    project.pages[0]?.id ??
    ''
  );
}

export const editorViewModelPages = {
  createInsertedPage,
  getNextPageIdAfterDelete,
  insertPageAfter,
};
