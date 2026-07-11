import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type AutomationControllerTranslationContractResult = {
  invalidTranslationError: string;
  translatedText: string | undefined;
};

export async function evaluateAutomationControllerTranslationContract(
  contractProject: ProjectDocument,
): Promise<AutomationControllerTranslationContractResult> {
  const [{ inMemoryAiServices }, { editorAutomationController }] = (await Promise.all([
    import('/editor/src/services/testing/inMemoryAiServices.ts'),
    import('/editor/src/services/automation/editorAutomationController.ts'),
  ])) as [
    typeof import('../../../apps/editor/src/services/testing/inMemoryAiServices'),
    typeof import('../../../apps/editor/src/services/automation/editorAutomationController'),
  ];

  const translator = new inMemoryAiServices.MockTranslatorService();
  let project = contractProject;
  let selection = { elementIds: ['text-1'], pageId: 'page-1', target: 'element' as const };
  const controller = new editorAutomationController.EditorAutomationController({
    createProject: () => Promise.resolve(project),
    generateImage: () => Promise.resolve(project),
    generateSlides: () => Promise.resolve(project),
    getState: () => ({ project, selection }),
    translateText: async ({ scope, targetLanguage }) => {
      project = {
        ...project,
        elements: {
          ...project.elements,
          'text-1': {
            ...project.elements['text-1'],
            text: await translator.translate(scope, targetLanguage),
          },
        },
      };
      selection = { ...selection };
      return { project, translatedPageIds: ['page-1'] };
    },
  });
  const invalidTranslation = await controller.translateText({
    scope: 'everything',
    targetLanguage: 'pt',
  });
  const translated = await controller.translateText({ scope: 'selection', targetLanguage: 'pt' });

  return {
    invalidTranslationError: invalidTranslation.ok ? '' : invalidTranslation.errorCode,
    translatedText: translated.ok
      ? translated.data.snapshot.pages[0]?.elements.find((element) => element.id === 'text-1')?.text
      : '',
  };
}
