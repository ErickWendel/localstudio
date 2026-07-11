import type {
  DesignElement,
  Page,
  PlaceholderRole,
  ProjectDocument,
  SlideLayout,
  TextElement,
} from '../../documents/model';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';

interface LayoutTextMatch {
  element: TextElement;
  placeholder: TextElement;
}

function isVisibleLayoutPlaceholder(layout: SlideLayout, element: TextElement) {
  const role = element.placeholderRole;
  return !role || layout.placeholderVisibility[role] !== false;
}

function getLayoutTextPlaceholders(layout: SlideLayout) {
  return layout.elementIds
    .map((elementId) => layout.elements[elementId])
    .filter(
      (element): element is TextElement =>
        element?.type === 'text' && isVisibleLayoutPlaceholder(layout, element),
    );
}

function createPageLayoutPlaceholderId(
  pageId: string,
  placeholderId: string,
  elements: Record<string, DesignElement>,
) {
  const baseId = `${pageId}-${placeholderId}`.replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!elements[baseId]) return baseId;

  let suffix = 2;
  while (elements[`${baseId}-${suffix}`]) suffix += 1;
  return `${baseId}-${suffix}`;
}

function getPageTextElements(project: ProjectDocument, page: Page) {
  return page.elementIds
    .map((elementId) => project.elements[elementId])
    .filter(
      (element): element is TextElement =>
        element?.type === 'text' && !element.locked && !element.templateSource,
    );
}

function sortTextElementsByReadingPriority(elements: TextElement[]) {
  return [...elements].sort((left, right) => {
    if (left.placeholderRole === 'title' && right.placeholderRole !== 'title') return -1;
    if (right.placeholderRole === 'title' && left.placeholderRole !== 'title') return 1;

    const fontSizeDelta = right.fontSize - left.fontSize;
    if (Math.abs(fontSizeDelta) > 8) return fontSizeDelta;

    const yDelta = left.y - right.y;
    if (Math.abs(yDelta) > 12) return yDelta;
    return left.x - right.x;
  });
}

function getFirstRemainingElement(
  elements: TextElement[],
  usedElementIds: Set<string>,
  role?: PlaceholderRole,
) {
  return elements.find(
    (element) =>
      !usedElementIds.has(element.id) && (role === undefined || element.placeholderRole === role),
  );
}

function getFirstRemainingPlaceholder(
  placeholders: TextElement[],
  usedPlaceholderIds: Set<string>,
  role?: PlaceholderRole,
) {
  return placeholders.find(
    (placeholder) =>
      !usedPlaceholderIds.has(placeholder.id) &&
      (role === undefined || placeholder.placeholderRole === role),
  );
}

function createLayoutTextMatches(elements: TextElement[], placeholders: TextElement[]) {
  const orderedElements = sortTextElementsByReadingPriority(elements);
  const matches: LayoutTextMatch[] = [];
  const usedElementIds = new Set<string>();
  const usedPlaceholderIds = new Set<string>();

  const addMatch = (element: TextElement | undefined, placeholder: TextElement | undefined) => {
    if (!element || !placeholder) return;
    matches.push({ element, placeholder });
    usedElementIds.add(element.id);
    usedPlaceholderIds.add(placeholder.id);
  };

  for (const role of ['title', 'body'] satisfies PlaceholderRole[]) {
    const explicitElement = getFirstRemainingElement(orderedElements, usedElementIds, role);
    const rolePlaceholder = getFirstRemainingPlaceholder(placeholders, usedPlaceholderIds, role);
    addMatch(explicitElement, rolePlaceholder);
  }

  addMatch(
    getFirstRemainingElement(orderedElements, usedElementIds),
    getFirstRemainingPlaceholder(placeholders, usedPlaceholderIds, 'title'),
  );

  while (true) {
    const element = getFirstRemainingElement(orderedElements, usedElementIds);
    const placeholder =
      getFirstRemainingPlaceholder(placeholders, usedPlaceholderIds, 'body') ??
      getFirstRemainingPlaceholder(placeholders, usedPlaceholderIds);
    if (!element || !placeholder) break;
    addMatch(element, placeholder);
  }

  return matches;
}

function getReadableTextHeight(element: TextElement) {
  const lineCount = Math.max(1, element.text.split('\n').length);
  return element.fontSize * (element.lineHeight ?? 1.05) * lineCount;
}

function applyLayoutTextPlaceholder(element: TextElement, placeholder: TextElement): TextElement {
  return {
    ...element,
    x: placeholder.x,
    y: placeholder.y,
    width: placeholder.width,
    height: Math.max(placeholder.height, getReadableTextHeight(element)),
    rotation: placeholder.rotation,
    opacity: placeholder.opacity,
    align: placeholder.align,
    ...(placeholder.verticalAlign !== undefined
      ? { verticalAlign: placeholder.verticalAlign }
      : {}),
    ...(placeholder.placeholderRole !== undefined
      ? { placeholderRole: placeholder.placeholderRole }
      : {}),
  };
}

function createSlideTextPlaceholder(
  pageId: string,
  placeholder: TextElement,
  elements: Record<string, DesignElement>,
): TextElement {
  const { templateSource, ...slideElement } = placeholder;
  void templateSource;
  return {
    ...slideElement,
    id: createPageLayoutPlaceholderId(pageId, placeholder.id, elements),
    locked: false,
  };
}

class ApplySlideLayoutCommand implements EditorCommand {
  readonly description = 'Apply slide layout';

  constructor(
    private readonly pageId: string,
    private readonly layoutId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const layout = project.slideLayouts?.[this.layoutId];
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!layout || !page) return project;

    const elements = { ...project.elements };
    const pageTextElements = getPageTextElements(project, page);
    const layoutTextPlaceholders = getLayoutTextPlaceholders(layout);
    const textMatches = createLayoutTextMatches(pageTextElements, layoutTextPlaceholders);
    const usedPlaceholderIds = new Set(textMatches.map(({ placeholder }) => placeholder.id));
    const elementIds = [...page.elementIds];

    for (const { element, placeholder } of textMatches) {
      elements[element.id] = applyLayoutTextPlaceholder(element, placeholder);
    }

    for (const placeholder of layoutTextPlaceholders) {
      if (usedPlaceholderIds.has(placeholder.id)) continue;
      const element = createSlideTextPlaceholder(page.id, placeholder, elements);
      elements[element.id] = element;
      elementIds.push(element.id);
    }

    return {
      ...project,
      elements,
      pages: project.pages.map((page) =>
        page.id === this.pageId ? { ...page, elementIds, layoutId: this.layoutId } : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SaveSlideLayoutCommand implements EditorCommand {
  readonly description: string = 'Save slide layout';

  constructor(private readonly layout: SlideLayout) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      slideLayouts: {
        ...(project.slideLayouts ?? {}),
        [this.layout.id]: this.layout,
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class EditSlideLayoutCommand extends SaveSlideLayoutCommand {
  override readonly description: string = 'Edit slide layout';
}

class ToggleSlideLayoutPlaceholderVisibilityCommand implements EditorCommand {
  readonly description = 'Toggle slide layout placeholder visibility';

  constructor(
    private readonly layoutId: string,
    private readonly role: PlaceholderRole,
    private readonly visible: boolean,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const layout = project.slideLayouts?.[this.layoutId];
    if (!layout) return project;
    return {
      ...project,
      slideLayouts: {
        ...(project.slideLayouts ?? {}),
        [this.layoutId]: {
          ...layout,
          placeholderVisibility: {
            ...layout.placeholderVisibility,
            [this.role]: this.visible,
          },
        },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const slideLayoutCommands = {
  ApplySlideLayoutCommand,
  EditSlideLayoutCommand,
  SaveSlideLayoutCommand,
  ToggleSlideLayoutPlaceholderVisibilityCommand,
};
