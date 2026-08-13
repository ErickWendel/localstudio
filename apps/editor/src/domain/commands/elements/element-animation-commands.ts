import type { Page, ProjectDocument } from '../../documents/model';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';
import type { ElementAnimationPatch } from './basicCommands';

function getPageAnimationBuilds(page: Page) {
  return page.animationBuilds ?? [];
}

function removeElementAnimationBuilds(page: Page, elementIds: Set<string>): Page {
  if (!page.animationBuilds) return page;
  return {
    ...page,
    animationBuilds: page.animationBuilds.filter((build) => !elementIds.has(build.elementId)),
  };
}

class SetElementAnimationBuildsCommand implements EditorCommand {
  readonly description = 'Set element animation builds';

  constructor(
    private readonly pageId: string,
    private readonly elementIds: string[],
    private readonly createBuildId: (elementId: string) => string,
    private readonly patch: ElementAnimationPatch,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const selectedIds = new Set(this.elementIds);

    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId) return page;
        const pageElementIds = new Set(page.elementIds);
        const orderedSelectedIds = page.elementIds.filter((elementId) =>
          selectedIds.has(elementId),
        );
        if (orderedSelectedIds.length === 0) return page;
        const existingBuilds = getPageAnimationBuilds(page);
        const existingByElementId = new Map(
          existingBuilds.map((build) => [build.elementId, build]),
        );
        const updatedByElementId = new Map(orderedSelectedIds.map((elementId) => {
          const existing = existingByElementId.get(elementId);
          return [elementId, {
            id: existing?.id ?? this.createBuildId(elementId),
            elementId,
            effect: this.patch.effect,
            trigger: this.patch.trigger,
            delayMs: Math.max(0, this.patch.delayMs),
            ...(this.patch.direction ? { direction: this.patch.direction } : {}),
            ...(this.patch.durationMs !== undefined
              ? { durationMs: Math.max(0, this.patch.durationMs) }
              : {}),
            ...(this.patch.kind ? { kind: this.patch.kind } : {}),
            ...(this.patch.lineDrawDirection
              ? { lineDrawDirection: this.patch.lineDrawDirection }
              : {}),
            ...(this.patch.mediaAction ? { mediaAction: this.patch.mediaAction } : {}),
          }] as const;
        }));
        const nextBuilds = existingBuilds.flatMap((build) => {
          if (!pageElementIds.has(build.elementId)) return [];
          if (!selectedIds.has(build.elementId)) return [build];
          const updated = updatedByElementId.get(build.elementId);
          if (!updated) return [];
          updatedByElementId.delete(build.elementId);
          return [updated];
        });
        nextBuilds.push(...updatedByElementId.values());
        return { ...page, animationBuilds: nextBuilds };
      }),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ClearElementAnimationBuildCommand implements EditorCommand {
  readonly description = 'Clear element animation build';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) =>
        page.id === this.pageId
          ? removeElementAnimationBuilds(page, new Set([this.elementId]))
          : page,
      ),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class ReorderElementAnimationBuildCommand implements EditorCommand {
  readonly description = 'Reorder element animation build';

  constructor(
    private readonly pageId: string,
    private readonly elementId: string,
    private readonly targetIndex: number,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      pages: project.pages.map((page) => {
        if (page.id !== this.pageId) return page;
        const builds = getPageAnimationBuilds(page);
        const currentIndex = builds.findIndex((build) => build.elementId === this.elementId);
        if (currentIndex < 0) return page;
        const nextBuilds = builds.filter((build) => build.elementId !== this.elementId);
        nextBuilds.splice(
          Math.max(0, Math.min(this.targetIndex, nextBuilds.length)),
          0,
          builds[currentIndex]!,
        );
        return { ...page, animationBuilds: nextBuilds };
      }),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const elementAnimationCommands = {
  ClearElementAnimationBuildCommand,
  ReorderElementAnimationBuildCommand,
  SetElementAnimationBuildsCommand,
  removeElementAnimationBuilds,
};
