import type { ProjectDocument } from '../model';

export interface EditorCommand {
  readonly description: string;
  execute(project: ProjectDocument): ProjectDocument;
}
