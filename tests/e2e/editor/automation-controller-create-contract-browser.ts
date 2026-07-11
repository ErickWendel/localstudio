import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type AutomationControllerCreateContractResult = {
  createdName: string;
};

export async function evaluateAutomationControllerCreateContract(
  contractProject: ProjectDocument,
): Promise<AutomationControllerCreateContractResult> {
  const { editorAutomationController } = (await import(
    '/editor/src/services/automation/editorAutomationController.ts'
  )) as typeof import('../../../apps/editor/src/services/automation/editorAutomationController');

  let project = contractProject;
  const controller = new editorAutomationController.EditorAutomationController({
    createProject: async ({ name }) => {
      await Promise.resolve();
      project = { ...project, name: name ?? 'Untitled' };
      return project;
    },
    generateImage: () => Promise.resolve(project),
    generateSlides: () => Promise.resolve(project),
    getState: () => ({
      project,
      selection: { elementIds: ['text-1'], pageId: 'page-1', target: 'element' },
    }),
    translateText: () => Promise.resolve({ project, translatedPageIds: ['page-1'] }),
  });
  const created = await controller.createProject({ name: 'Automated Deck' });

  return {
    createdName: created.ok ? created.data.name : '',
  };
}
