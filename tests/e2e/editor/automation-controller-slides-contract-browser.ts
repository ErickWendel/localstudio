import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type AutomationControllerSlidesContractResult = {
  emptySlidesError: string;
  generatedSlidesName: string;
};

export async function evaluateAutomationControllerSlidesContract(
  contractProject: ProjectDocument,
): Promise<AutomationControllerSlidesContractResult> {
  const { editorAutomationController } = (await import(
    '/editor/src/services/automation/editorAutomationController.ts'
  )) as typeof import('../../../apps/editor/src/services/automation/editorAutomationController');

  let project = contractProject;
  const controller = new editorAutomationController.EditorAutomationController({
    createProject: () => Promise.resolve(project),
    generateImage: () => Promise.resolve(project),
    generateSlides: async ({ prompt }) => {
      await Promise.resolve();
      project = { ...project, name: prompt };
      return project;
    },
    getState: () => ({
      project,
      selection: { elementIds: ['text-1'], pageId: 'page-1', target: 'element' },
    }),
    translateText: () => Promise.resolve({ project, translatedPageIds: ['page-1'] }),
  });
  const emptySlides = await controller.generateSlides({ prompt: '' });
  const generatedSlides = await controller.generateSlides({ prompt: 'Generated deck' });

  return {
    emptySlidesError: emptySlides.ok ? '' : emptySlides.errorCode,
    generatedSlidesName: generatedSlides.ok ? generatedSlides.data.snapshot.name : '',
  };
}
