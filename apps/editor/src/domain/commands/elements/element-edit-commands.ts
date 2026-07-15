import type { Asset, DesignElement, ProjectDocument } from '../../documents/model';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';
import type { ElementFramePatch, ElementStylePatch } from './basicCommands';

class AddElementsCommand implements EditorCommand {
  readonly description = 'Add elements';

  constructor(
    private readonly pageId: string,
    private readonly elements: DesignElement[],
    private readonly assets: Record<string, Asset> = {},
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (this.elements.length === 0) return project;

    return {
      ...project,
      assets: {
        ...project.assets,
        ...this.assets,
      },
      elements: {
        ...project.elements,
        ...Object.fromEntries(this.elements.map((element) => [element.id, element])),
      },
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? {
              ...page,
              elementIds: [...page.elementIds, ...this.elements.map((element) => element.id)],
            }
          : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateElementFrameCommand implements EditorCommand {
  readonly description = 'Update element frame';

  constructor(
    private readonly elementId: string,
    private readonly patch: ElementFramePatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.locked) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: {
          ...element,
          ...this.patch,
          width: this.patch.width === undefined ? element.width : Math.max(1, this.patch.width),
          height: this.patch.height === undefined ? element.height : Math.max(1, this.patch.height),
        },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateElementFramesCommand implements EditorCommand {
  readonly description = 'Update element frames';

  constructor(private readonly patches: Record<string, ElementFramePatch>) {}

  execute(project: ProjectDocument): ProjectDocument {
    const nextElements = { ...project.elements };
    let didChange = false;

    for (const [elementId, patch] of Object.entries(this.patches)) {
      const element = nextElements[elementId];
      if (!element || element.locked) continue;
      nextElements[elementId] = {
        ...element,
        ...patch,
        width: patch.width === undefined ? element.width : Math.max(1, patch.width),
        height: patch.height === undefined ? element.height : Math.max(1, patch.height),
      };
      didChange = true;
    }

    if (!didChange) return project;

    return {
      ...project,
      elements: nextElements,
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateTextContentCommand implements EditorCommand {
  readonly description = 'Update text content';

  constructor(
    private readonly elementId: string,
    private readonly text: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'text' || element.locked) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: {
          ...element,
          text: this.text,
        },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class UpdateElementStyleCommand implements EditorCommand {
  readonly description = 'Update element style';

  constructor(
    private readonly elementId: string,
    private readonly patch: ElementStylePatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.locked) return project;

    const opacity =
      this.patch.opacity === undefined
        ? element.opacity
        : Math.max(0, Math.min(1, this.patch.opacity));
    let nextElement: DesignElement = { ...element, opacity };

    if (element.type === 'text') {
      const nextTextElement = {
        ...element,
        opacity,
        ...(this.patch.align ? { align: this.patch.align } : {}),
        ...(typeof this.patch.fill === 'string' ? { fill: this.patch.fill } : {}),
        ...(this.patch.fontFamily ? { fontFamily: this.patch.fontFamily } : {}),
        ...(this.patch.fontSize !== undefined
          ? { fontSize: Math.max(1, this.patch.fontSize) }
          : {}),
        ...(this.patch.fontWeight !== undefined ? { fontWeight: this.patch.fontWeight } : {}),
      };
      if (typeof this.patch.hyperlink === 'string') {
        nextTextElement.hyperlink = this.patch.hyperlink;
      }
      if (this.patch.hyperlink === null) {
        delete nextTextElement.hyperlink;
      }
      nextElement = nextTextElement;
    }

    if (element.type === 'shape') {
      const { endEndpoint, fill, startEndpoint, stroke, strokeWidth } = this.patch;
      const nextShapeElement = {
        ...nextElement,
        ...(typeof fill === 'string' ? { fill } : {}),
        ...(typeof stroke === 'string' ? { stroke } : {}),
        ...(strokeWidth !== undefined ? { strokeWidth: Math.max(0, strokeWidth) } : {}),
        ...(startEndpoint !== undefined ? { startEndpoint } : {}),
        ...(endEndpoint !== undefined ? { endEndpoint } : {}),
      };
      if (fill === null) {
        delete nextShapeElement.fill;
      }
      if (stroke === null) {
        delete nextShapeElement.stroke;
      }
      nextElement = nextShapeElement;
    }

    return {
      ...project,
      elements: {
        ...project.elements,
        [this.elementId]: nextElement,
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const elementEditCommands = {
  AddElementsCommand,
  UpdateElementFrameCommand,
  UpdateElementFramesCommand,
  UpdateElementStyleCommand,
  UpdateTextContentCommand,
};
