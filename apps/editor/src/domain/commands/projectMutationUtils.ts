import type { ProjectDocument } from '../model';

export function getProjectUpdatedAt() {
  return new Date().toISOString();
}

export function touchProject(project: ProjectDocument): ProjectDocument {
  return {
    ...project,
    updatedAt: getProjectUpdatedAt(),
  };
}
