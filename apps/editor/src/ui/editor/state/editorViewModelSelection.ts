import type { ProjectDocument, SelectionState } from '../../../domain/documents/model';

function getSelectionTargetForElements(elementIds: string[]): NonNullable<SelectionState['target']> {
  return elementIds.length > 0 ? 'elements' : 'slide';
}

function getNextElementSelection(input: {
  additive?: boolean;
  currentSelection: string[];
  elementId: string;
}) {
  if (!input.additive) return [input.elementId];
  if (input.currentSelection.includes(input.elementId)) {
    return input.currentSelection.filter((id) => id !== input.elementId);
  }
  return [...input.currentSelection, input.elementId];
}

function getSelectableElementIdsOnPage(input: {
  pageId: string;
  processingElementIds: string[];
  project: ProjectDocument;
}) {
  const page = input.project.pages.find((item) => item.id === input.pageId);
  if (!page) return [];
  return page.elementIds.filter((elementId) => {
    const element = input.project.elements[elementId];
    return element && element.visible !== false && !input.processingElementIds.includes(elementId);
  });
}

export const editorViewModelSelection = {
  getNextElementSelection,
  getSelectableElementIdsOnPage,
  getSelectionTargetForElements,
};
