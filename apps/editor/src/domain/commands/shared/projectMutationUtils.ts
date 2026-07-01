import type { ProjectDocument } from '../../model';

function getProjectUpdatedAt() {
  return new Date().toISOString();
}

function touchProject(project: ProjectDocument): ProjectDocument {
  return {
    ...project,
    updatedAt: getProjectUpdatedAt(),
  };
}

export const projectMutationUtils = {
  getProjectUpdatedAt,
  touchProject,
};
