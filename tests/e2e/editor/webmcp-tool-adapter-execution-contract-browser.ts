export type WebMcpToolAdapterExecutionContractResult = {
  controllerCalls: Array<{ input: unknown; name: string }>;
  created: unknown;
  imageOperation: unknown;
  imageStatus: unknown;
  preview: unknown;
  state: unknown;
};

export async function evaluateWebMcpToolAdapterExecutionContract(): Promise<WebMcpToolAdapterExecutionContractResult> {
  const [{ authoringAutomationController }, { WebMcpToolAdapter }] = (await Promise.all([
    import('/editor/src/services/automation/authoringAutomationController.ts'),
    import('/editor/src/services/webmcp/webMcpToolAdapter.ts'),
  ])) as [
    typeof import('../../../apps/editor/src/services/automation/authoringAutomationController'),
    typeof import('../../../apps/editor/src/services/webmcp/webMcpToolAdapter'),
  ];
  const controllerCalls: Array<{ input: unknown; name: string }> = [];
  const unused = () => Promise.resolve({});
  const controller = new authoringAutomationController.AuthoringAutomationController({
    createPresentation: (input) => {
      controllerCalls.push({ input, name: 'createPresentation' });
      return { projectId: 'project-1', name: input.name ?? 'Untitled' };
    },
    getPresentationState: (input) => {
      controllerCalls.push({ input, name: 'getPresentationState' });
      return { projectId: 'project-1', pageCount: 1 };
    },
    importPowerPointFromUrl: unused,
    translateDeckAndNotes: unused,
    generateDeckDetailedDescription: unused,
    listAuthoringCatalog: unused,
    upsertSlideContent: () => Promise.reject(new Error('unused')),
    generateImage: (input, report) => {
      controllerCalls.push({ input, name: 'generateImage' });
      report({ stage: 'generating-image', progress: 70 });
      return Promise.resolve({ assetId: 'asset-generated' });
    },
    getSlidePreview: (input) => {
      controllerCalls.push({ input, name: 'getSlidePreview' });
      return { slideId: 'page-1', slideNumber: input.slideNumber };
    },
    getAiModelStatus: unused,
    prepareAiModels: () => Promise.resolve([]),
    searchMedia: unused,
    exportPresentation: unused,
    publishPresentation: unused,
  });
  const tools = new WebMcpToolAdapter(controller).createTools();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const created = await byName
    .get('create_presentation')!
    .execute({ name: 'WebMCP Deck', width: 1600, height: 900 });
  const state = await byName.get('get_presentation_state')!.execute({ detail: 'summary' });
  const preview = await byName.get('get_slide_preview')!.execute({ slideNumber: 1 });
  const imageOperation = await byName
    .get('generate_image')!
    .execute({ prompt: 'neon card', width: 512, height: 512 });
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  const operationId =
    imageOperation.ok &&
    typeof imageOperation.data === 'object' &&
    imageOperation.data &&
    'operationId' in imageOperation.data
      ? String(imageOperation.data.operationId)
      : '';
  const imageStatus = await byName.get('get_operation_status')!.execute({ operationId });

  return { controllerCalls, created, imageOperation, imageStatus, preview, state };
}
