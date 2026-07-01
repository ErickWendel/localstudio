import type { ProjectDocument } from '../../documents/model';

export interface EditorCommand {
  readonly description: string;
  execute(project: ProjectDocument): ProjectDocument;
}
