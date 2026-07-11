import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type AutomationControllerSnapshotContractResult = {
  snapshotPageCount: number;
};

export async function evaluateAutomationControllerSnapshotContract(
  contractProject: ProjectDocument,
): Promise<AutomationControllerSnapshotContractResult> {
  const { editorAutomationController } = (await import(
    '/editor/src/services/automation/editorAutomationController.ts'
  )) as typeof import('../../../apps/editor/src/services/automation/editorAutomationController');

  const controller = new editorAutomationController.EditorAutomationController({
    createProject: () => Promise.resolve(contractProject),
    generateImage: () => Promise.resolve(contractProject),
    generateSlides: () => Promise.resolve(contractProject),
    getState: () => ({
      project: contractProject,
      selection: { elementIds: ['text-1'], pageId: 'page-1', target: 'element' },
    }),
    translateText: () => Promise.resolve({ project: contractProject, translatedPageIds: ['page-1'] }),
  });
  const snapshot = controller.getProjectSnapshot();

  return {
    snapshotPageCount: snapshot.ok ? snapshot.data.snapshot.pages.length : 0,
  };
}
