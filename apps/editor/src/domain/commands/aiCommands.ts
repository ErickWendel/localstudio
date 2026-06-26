import type { ProjectDocument, TextElement } from '../model';
import type { EditorCommand } from './types';

export class TranslateTextCommand implements EditorCommand {
  readonly description = 'Translate text';

  constructor(
    private readonly elementId: string,
    private readonly translatedText: string,
  ) {}

  execute(project: ProjectDocument): ProjectDocument {
    const element = project.elements[this.elementId];
    if (!element || element.type !== 'text') return project;

    const nextElement: TextElement = { ...element, text: this.translatedText };
    return {
      ...project,
      elements: { ...project.elements, [this.elementId]: nextElement },
    };
  }
}
