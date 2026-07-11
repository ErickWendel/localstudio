import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type ProjectMutationUtilsContractResult = {
  timestamp: string;
  touchedName: string;
  touchedUpdatedAt: string;
};

export async function evaluateProjectMutationUtilsContract(
  project: ProjectDocument,
): Promise<ProjectMutationUtilsContractResult> {
  const { projectMutationUtils } = (await import(
    '/editor/src/domain/commands/shared/projectMutationUtils.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/shared/projectMutationUtils');

  const touched = projectMutationUtils.touchProject(project);
  const timestamp = projectMutationUtils.getProjectUpdatedAt();

  return {
    timestamp,
    touchedName: touched.name,
    touchedUpdatedAt: touched.updatedAt,
  };
}
