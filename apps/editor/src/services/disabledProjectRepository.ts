import type { ProjectDocument } from '../domain/model';
import type { ProjectRepository } from './interfaces';

export class DisabledProjectRepository implements ProjectRepository {
  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    void project;
    return Promise.resolve();
  }
}
