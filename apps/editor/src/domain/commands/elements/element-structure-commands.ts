import type { DesignElement, ProjectDocument } from '../../documents/model';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';
import type { AlignMode, ZOrderMode } from './basicCommands';
import { elementAnimationCommands } from './element-animation-commands';

class AlignElementCommand implements EditorCommand {
  readonly description = 'Align element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly mode: AlignMode,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const page = project.pages.find((item) => item.id === this.pageId);
    const element = project.elements[this.elementId];
    if (!page || !element || element.locked) return project;

    const patch = {
      x:
        this.mode === 'horizontal-center' || this.mode === 'page-center'
          ? (page.width - element.width) / 2
          : element.x,
      y:
        this.mode === 'vertical-center' || this.mode === 'page-center'
          ? (page.height - element.height) / 2
          : element.y,
    };

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: { ...element, ...patch },
      },
    };
  }
}

class SetZOrderCommand implements EditorCommand {
  readonly description = 'Set z-order';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly mode: ZOrderMode,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId || !page.elementIds.includes(this.elementId)) return page;
        const without = page.elementIds.filter((id) => id !== this.elementId);
        const currentIndex = page.elementIds.indexOf(this.elementId);

        if (this.mode === 'front') return { ...page, elementIds: [...without, this.elementId] };
        if (this.mode === 'back') return { ...page, elementIds: [this.elementId, ...without] };

        const targetIndex =
          this.mode === 'forward'
            ? Math.min(currentIndex + 1, page.elementIds.length - 1)
            : Math.max(currentIndex - 1, 0);
        const next = [...without];
        next.splice(targetIndex, 0, this.elementId);
        return { ...page, elementIds: next };
      }),
    };
  }
}

class DuplicateElementCommand implements EditorCommand {
  readonly description = 'Duplicate element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly nextElementId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    const page = project.pages.find((item) => item.id === this.pageId);
    if (!element || !page || element.locked) return project;

    const nextElement: DesignElement = {
      ...element,
      id: this.nextElementId,
      x: element.x + 24,
      y: element.y + 24,
      locked: false,
    };

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.nextElementId]: nextElement,
      },
      pages: project.pages.map((item) =>
        item.id === this.pageId
          ? { ...item, elementIds: [...item.elementIds, this.nextElementId] }
          : item,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class DeleteElementCommand implements EditorCommand {
  readonly description = 'Delete element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const { [this.elementId]: deleted, ...remainingElements } = project.elements;
    void deleted;

    return {
      ...project,
      elements: remainingElements,
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? elementAnimationCommands.removeElementAnimationBuilds(
              { ...page, elementIds: page.elementIds.filter((id) => id !== this.elementId) },
              new Set([this.elementId]),
            )
          : page,
      ),
    };
  }
}

class ReorderElementCommand implements EditorCommand {
  readonly description = 'Reorder element';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly targetIndex: number,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId || !page.elementIds.includes(this.elementId)) return page;
        const without = page.elementIds.filter((id) => id !== this.elementId);
        const next = [...without];
        next.splice(Math.max(0, Math.min(this.targetIndex, next.length)), 0, this.elementId);
        return { ...page, elementIds: next };
      }),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetElementVisibilityCommand implements EditorCommand {
  readonly description = 'Set element visibility';

  constructor(
    private readonly elementId: string,
    private readonly visible: boolean,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: { ...element, visible: this.visible },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SetElementLockCommand implements EditorCommand {
  readonly description = 'Set element lock';

  constructor(
    private readonly elementId: string,
    private readonly locked: boolean,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: { ...element, locked: this.locked },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const elementStructureCommands = {
  AlignElementCommand,
  DeleteElementCommand,
  DuplicateElementCommand,
  ReorderElementCommand,
  SetElementLockCommand,
  SetElementVisibilityCommand,
  SetZOrderCommand,
};
