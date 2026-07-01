import type { ProjectDocument } from '../../domain/documents/model';
import type { ProjectRepository } from '../contracts/interfaces';

export class DisabledProjectRepository implements ProjectRepository {
  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    void project;
    return Promise.resolve();
  }
}
