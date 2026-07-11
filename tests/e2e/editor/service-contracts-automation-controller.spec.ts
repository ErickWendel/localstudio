import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { aiAutomationContractProject } from './ai-automation-contract-project';
import { serviceContractsSupport } from './service-contracts-support';

test('executes editor automation controller contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async (contractProject) => {
    const [{ inMemoryAiServices }, { editorAutomationController }] = (await Promise.all([
      import('/editor/src/services/testing/inMemoryAiServices.ts'),
      import('/editor/src/services/automation/editorAutomationController.ts'),
    ])) as [
      typeof import('../../../apps/editor/src/services/testing/inMemoryAiServices'),
      typeof import('../../../apps/editor/src/services/automation/editorAutomationController'),
    ];

    const translator = new inMemoryAiServices.MockTranslatorService();
    const imageService = new inMemoryAiServices.MockImageGenerationService();
    let project = contractProject;
    let selection = { elementIds: ['text-1'], pageId: 'page-1', target: 'element' };
    const controller = new editorAutomationController.EditorAutomationController({
      createProject: async ({ name }) => {
        await Promise.resolve();
        project = { ...project, name: name ?? 'Untitled' };
        return project;
      },
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
      generateSlides: async ({ prompt }) => {
        await Promise.resolve();
        project = { ...project, name: prompt };
        return project;
      },
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

    const created = await controller.createProject({ name: 'Automated Deck' });
    const emptySlides = await controller.generateSlides({ prompt: '' });
    const generatedSlides = await controller.generateSlides({ prompt: 'Generated deck' });
    const invalidImage = await controller.generateImage({ height: 123, prompt: 'invalid', width: 512 });
    const generatedImage = await controller.generateImage({ height: 512, prompt: 'valid', width: 512 });
    const invalidTranslation = await controller.translateText({
      scope: 'everything',
      targetLanguage: 'pt',
    });
    const translated = await controller.translateText({ scope: 'selection', targetLanguage: 'pt' });
    const snapshot = controller.getProjectSnapshot();

    return {
      createdName: created.ok ? created.data.name : '',
      emptySlidesError: emptySlides.ok ? '' : emptySlides.errorCode,
      generatedImageOk: generatedImage.ok,
      generatedSlidesName: generatedSlides.ok ? generatedSlides.data.snapshot.name : '',
      invalidImageError: invalidImage.ok ? '' : invalidImage.errorCode,
      invalidTranslationError: invalidTranslation.ok ? '' : invalidTranslation.errorCode,
      snapshotPageCount: snapshot.ok ? snapshot.data.snapshot.pages.length : 0,
      translatedText: translated.ok
        ? translated.data.snapshot.pages[0]?.elements.find((element) => element.id === 'text-1')?.text
        : '',
    };
  }, aiAutomationContractProject.createProject());

  expect(result).toMatchObject({
    createdName: 'Automated Deck',
    emptySlidesError: 'empty_prompt',
    generatedImageOk: true,
    generatedSlidesName: 'Generated deck',
    invalidImageError: 'invalid_image_dimensions',
    invalidTranslationError: 'invalid_translation_scope',
    snapshotPageCount: 1,
    translatedText: '[pt] selection',
  });
});
