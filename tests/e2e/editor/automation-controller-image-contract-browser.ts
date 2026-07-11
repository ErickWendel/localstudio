import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type AutomationControllerImageContractResult = {
  generatedImageOk: boolean;
  invalidImageError: string;
};

export async function evaluateAutomationControllerImageContract(
  contractProject: ProjectDocument,
): Promise<AutomationControllerImageContractResult> {
  const [{ inMemoryAiServices }, { editorAutomationController }] = (await Promise.all([
    import('/editor/src/services/testing/inMemoryAiServices.ts'),
    import('/editor/src/services/automation/editorAutomationController.ts'),
  ])) as [
    typeof import('../../../apps/editor/src/services/testing/inMemoryAiServices'),
    typeof import('../../../apps/editor/src/services/automation/editorAutomationController'),
  ];

  const imageService = new inMemoryAiServices.MockImageGenerationService();
  let project = contractProject;
  const controller = new editorAutomationController.EditorAutomationController({
    createProject: () => Promise.resolve(project),
    generateImage: async ({ prompt }) => {
      project = {
        ...project,
        assets: {
          ...project.assets,
          generated: await imageService.generateImage(prompt),
        },
      };
      return project;
    },
    generateSlides: () => Promise.resolve(project),
    getState: () => ({
      project,
      selection: { elementIds: ['text-1'], pageId: 'page-1', target: 'element' },
    }),
    translateText: () => Promise.resolve({ project, translatedPageIds: ['page-1'] }),
  });
  const invalidImage = await controller.generateImage({ height: 123, prompt: 'invalid', width: 512 });
  const generatedImage = await controller.generateImage({ height: 512, prompt: 'valid', width: 512 });

  return {
    generatedImageOk: generatedImage.ok,
    invalidImageError: invalidImage.ok ? '' : invalidImage.errorCode,
  };
}
