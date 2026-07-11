export type WebMcpToolAdapterExecutionContractResult = {
  controllerCalls: Array<{ input: unknown; name: string }>;
  createProjectBlank: unknown;
  createProjectNamed: unknown;
  generatedImage: unknown;
  generatedSlides: unknown;
  snapshot: unknown;
  translated: unknown;
  translatedWithoutPage: unknown;
};

export async function evaluateWebMcpToolAdapterExecutionContract(): Promise<WebMcpToolAdapterExecutionContractResult> {
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

  return {
    controllerCalls,
    createProjectBlank,
    createProjectNamed,
    generatedImage,
    generatedSlides,
    snapshot,
    translated,
    translatedWithoutPage,
  };
}
