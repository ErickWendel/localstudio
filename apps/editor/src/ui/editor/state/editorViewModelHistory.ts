import type { ProjectDocument } from '../../../domain/documents/model';

export interface EditorHistory {
  past: ProjectDocument[];
  future: ProjectDocument[];
}

function getActivePageIdForProject(project: ProjectDocument, currentPageId: string) {
  return project.pages.some((page) => page.id === currentPageId)
    ? currentPageId
    : (project.pages[0]?.id ?? '');
}

function getSelectionForProject(input: {
  currentSelection: string[];
  pageId: string;
  project: ProjectDocument;
}) {
  const page = input.project.pages.find((item) => item.id === input.pageId) ?? input.project.pages[0];
  const retainedSelection = input.currentSelection.filter((id) => page?.elementIds.includes(id));
  if (retainedSelection.length > 0) return retainedSelection;
  const nextSelectedId = page?.elementIds.at(-1);
  return nextSelectedId ? [nextSelectedId] : [];
}

export const editorViewModelHistory = {
  getActivePageIdForProject,
  getSelectionForProject,
};
