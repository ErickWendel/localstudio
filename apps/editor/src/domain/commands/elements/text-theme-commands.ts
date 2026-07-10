import type { PresentationTheme, ProjectDocument } from '../../documents/model';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';

interface TextTranslationPatch {
  fontSize?: number;
  height?: number;
  width?: number;
  x?: number;
  text: string;
}

type TextTranslationValue = string | TextTranslationPatch;

class TranslateTextElementsCommand implements EditorCommand {
  readonly description = 'Translate text elements';

  constructor(private readonly translations: Record<string, TextTranslationValue>) {}

  execute(project: ProjectDocument): ProjectDocument {
    const nextElements = { ...project.elements };
    let didChange = false;

    for (const [elementId, translation] of Object.entries(this.translations)) {
      const element = nextElements[elementId];
      if (!element || element.type !== 'text' || element.locked) continue;
      const patch = typeof translation === 'string' ? { text: translation } : translation;
      if (patch.text === element.text && patch.fontSize === undefined) continue;

      nextElements[elementId] = {
        ...element,
        ...patch,
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

class ApplyThemeCommand implements EditorCommand {
  readonly description = 'Apply theme';

  constructor(private readonly themeId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (!project.themes?.[this.themeId]) return project;
    return {
      ...project,
      themeId: this.themeId,
      themeGallery: Array.from(new Set([...(project.themeGallery ?? []), this.themeId])),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class SaveThemeCommand implements EditorCommand {
  readonly description: string = 'Save theme';

  constructor(private readonly theme: PresentationTheme) {}

  execute(project: ProjectDocument): ProjectDocument {
    return {
      ...project,
      themes: {
        ...(project.themes ?? {}),
        [this.theme.id]: this.theme,
      },
      themeGallery: Array.from(new Set([...(project.themeGallery ?? []), this.theme.id])),
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class EditThemeCommand extends SaveThemeCommand {
  override readonly description: string = 'Edit theme';
}

export const textThemeCommands = {
  ApplyThemeCommand,
  EditThemeCommand,
  SaveThemeCommand,
  TranslateTextElementsCommand,
};
