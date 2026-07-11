import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes WebMCP tool adapter contracts in the browser runtime', async ({ page }) => {
  await page.goto(new URL('/editor/?newProject=1', serviceContractsSupport.getServer().baseURL).toString());

  const result = await page.evaluate(async () => {
    const { WebMcpToolAdapter } = (await import(
      '/editor/src/services/webmcp/webMcpToolAdapter.ts'
    )) as typeof import('../../../apps/editor/src/services/webmcp/webMcpToolAdapter');

    const controllerCalls: Array<{ input: unknown; name: string }> = [];
    const adapter = new WebMcpToolAdapter({
      createProject: (input) => {
        controllerCalls.push({ input, name: 'createProject' });
        return { data: { name: input.name ?? 'Untitled' }, ok: true };
      },
      generateImage: (input) => {
        controllerCalls.push({ input, name: 'generateImage' });
        return { data: { assetId: 'asset-generated' }, ok: true };
      },
      generateSlides: (input) => {
        controllerCalls.push({ input, name: 'generateSlides' });
        return { data: { prompt: input.prompt }, ok: true };
      },
      getProjectSnapshot: () => {
        controllerCalls.push({ input: {}, name: 'getProjectSnapshot' });
        return { data: { pageCount: 1 }, ok: true };
      },
      translateText: (input) => {
        controllerCalls.push({ input, name: 'translateText' });
        return { data: { scope: input.scope }, ok: true };
      },
    });
    const tools = adapter.createTools();
    const createProjectNamed = await tools[0].execute({ name: 'WebMCP Deck' });
    const createProjectBlank = await tools[0].execute({ name: 123 });
    const generatedSlides = await tools[1].execute({ prompt: 'Create a launch slide' });
    const generatedImage = await tools[2].execute({
      height: 512,
      prompt: 'neon card',
      seed: Number.NaN,
      steps: 8,
      width: 512,
    });
    const translated = await tools[3].execute({
      pageId: 'page-1',
      scope: 'slide',
      targetLanguage: 'pt',
    });
    const translatedWithoutPage = await tools[3].execute({
      pageId: 5,
      scope: 'deck',
      targetLanguage: 'es',
    });
    const snapshot = await tools[4].execute({});
    const registeredNames: string[] = [];
    const unregisterBatch = adapter.register({
      registerTools: (registeredTools) => {
        registeredNames.push(...registeredTools.map((tool) => tool.name));
      },
    });
    unregisterBatch();
    const individuallyRegisteredNames: string[] = [];
    adapter.register({
      registerTool: (tool) => {
        individuallyRegisteredNames.push(tool.name);
      },
    });
    return {
      controllerCalls,
      createProjectBlank,
      createProjectNamed,
      generatedImage,
      generatedSlides,
      individuallyRegisteredNames,
      registeredNames,
      snapshot,
      translated,
      translatedWithoutPage,
      toolDescriptions: tools.map((tool) => tool.description),
      toolNames: tools.map((tool) => tool.name),
    };
  });

  expect(result.toolNames).toEqual([
    'create_project',
    'generate_slides',
    'generate_image',
    'translate_text',
    'get_project_snapshot',
  ]);
  expect(result).toMatchObject({
    createProjectBlank: { data: { name: 'Untitled' }, ok: true },
    createProjectNamed: { data: { name: 'WebMCP Deck' }, ok: true },
    generatedImage: { data: { assetId: 'asset-generated' }, ok: true },
    generatedSlides: { data: { prompt: 'Create a launch slide' }, ok: true },
    registeredNames: [
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ],
    snapshot: { data: { pageCount: 1 }, ok: true },
    translated: { data: { scope: 'slide' }, ok: true },
    translatedWithoutPage: { data: { scope: 'deck' }, ok: true },
  });
  expect(result.controllerCalls.map((call) => call.name)).toEqual([
    'createProject',
    'createProject',
    'generateSlides',
    'generateImage',
    'translateText',
    'translateText',
    'getProjectSnapshot',
  ]);
  expect(result.individuallyRegisteredNames).toEqual(result.registeredNames);
  expect(result.toolDescriptions.join('\n')).toContain('Good prompt examples');
});
