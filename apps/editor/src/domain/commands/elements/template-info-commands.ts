import type { ProjectDocument } from '../../documents/model';
import { pptxTemplateInfo } from '../../documents/pptxTemplateInfo';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';

class SetDeckTemplateInfoVisibilityCommand implements EditorCommand {
  readonly description = 'Set deck template information visibility';

  constructor(private readonly visible: boolean) {}

  execute(project: ProjectDocument): ProjectDocument {
    const templateElements = pptxTemplateInfo.getDeckElements(project);
    if (templateElements.length === 0) return project;

    return {
      ...project,
      elements: {
        ...project.elements,
        ...Object.fromEntries(
          templateElements.map((element) => [
            element.id,
            { ...element, visible: this.visible },
          ]),
        ),
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const templateInfoCommands = {
  SetDeckTemplateInfoVisibilityCommand,
};
