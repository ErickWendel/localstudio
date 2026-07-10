import type {
  DesignElement,
  ElementAnimationBuild,
  Page,
  PageBackground,
  ProjectDocument,
  SlideTransition,
} from '../../documents/model';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';

function getPageAnimationBuilds(page: Page) {
  return page.animationBuilds ?? [];
}

class DuplicatePageCommand implements EditorCommand {
  readonly description = 'Duplicate page';

  constructor(
    private readonly pageId: string,
    private readonly nextPageId: string,
    private readonly createElementId: (elementId: string) => string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;

    const elementIdPairs = page.elementIds.map(
      (elementId) => [elementId, this.createElementId(elementId)] as const,
    );
    const elementIdMap = new Map(elementIdPairs);
    const duplicatedElements = Object.fromEntries(
      elementIdPairs
        .map(([sourceElementId, nextElementId]) => {
          const element = project.elements[sourceElementId];
          return element
            ? [nextElementId, { ...element, id: nextElementId, locked: false }]
            : undefined;
        })
        .filter((entry): entry is [string, DesignElement] => Boolean(entry)),
    );
    const pageIndex = project.pages.indexOf(page);
    const duplicatedPage: Page = {
      ...page,
      id: this.nextPageId,
      name: `${page.name} copy`,
      elementIds: page.elementIds
        .map((elementId) => elementIdMap.get(elementId))
        .filter((elementId): elementId is string => Boolean(elementId)),
      animationBuilds: getPageAnimationBuilds(page)
        .map((build) => {
          const nextElementId = elementIdMap.get(build.elementId);
          return nextElementId
            ? {
                ...build,
                id: this.createElementId(build.id),
                elementId: nextElementId,
              }
            : undefined;
        })
        .filter((build): build is ElementAnimationBuild => Boolean(build)),
      visible: page.visible ?? true,
    };
    const pages = [...project.pages];
    pages.splice(pageIndex + 1, 0, duplicatedPage);

    return {
      ...project,
      elements: {
        ...project.elements,
        ...duplicatedElements,
      },
      pages,
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class DeletePageCommand implements EditorCommand {
  readonly description = 'Delete page';

  constructor(private readonly pageId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (project.pages.length <= 1) return project;
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!page) return project;
    const deletedElementIds = new Set(page.elementIds);
    const elements = Object.fromEntries(
      Object.entries(project.elements).filter(([elementId]) => !deletedElementIds.has(elementId)),
    );
    return {
      ...project,
      elements,
      pages: project.pages.filter((item) => item.id !== this.pageId),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ReorderPageCommand implements EditorCommand {
  readonly description = 'Reorder page';

  constructor(
    private readonly pageId: string,
    private readonly targetIndex: number,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const currentIndex = project.pages.findIndex((page) => page.id === this.pageId);
    if (currentIndex < 0) return project;
    const pages = project.pages.filter((page) => page.id !== this.pageId);
    pages.splice(
      Math.max(0, Math.min(this.targetIndex, pages.length)),
      0,
      project.pages[currentIndex]!,
    );
    return {
      ...project,
      pages,
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class RenamePageCommand implements EditorCommand {
  readonly description = 'Rename page';

  constructor(
    private readonly pageId: string,
    private readonly name: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const nextName = this.name.trim();
    if (!nextName) return project;
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId ? { ...page, name: nextName } : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetPageVisibilityCommand implements EditorCommand {
  readonly description = 'Set page visibility';

  constructor(
    private readonly pageId: string,
    private readonly visible: boolean,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId ? { ...page, visible: this.visible } : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdatePageBackgroundCommand implements EditorCommand {
  readonly description = 'Update page background';

  constructor(
    private readonly pageId: string,
    private readonly background: PageBackground,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId ? { ...page, background: this.background } : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetPageTransitionCommand implements EditorCommand {
  readonly description = 'Set page transition';

  constructor(
    private readonly pageId: string,
    private readonly transition: SlideTransition,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? {
              ...page,
              transition: { ...this.transition, delayMs: Math.max(0, this.transition.delayMs) },
            }
          : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ClearPageTransitionCommand implements EditorCommand {
  readonly description = 'Clear page transition';

  constructor(private readonly pageId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId) return page;
        const { transition, ...nextPage } = page;
        void transition;
        return nextPage;
      }),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const pageCommands = {
  ClearPageTransitionCommand,
  DeletePageCommand,
  DuplicatePageCommand,
  RenamePageCommand,
  ReorderPageCommand,
  SetPageTransitionCommand,
  SetPageVisibilityCommand,
  UpdatePageBackgroundCommand,
};
