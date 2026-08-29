export type WebMcpToolAdapterMetadataContractResult = {
  readOnlyNames: string[];
  toolDescriptions: string[];
  toolNames: string[];
  toolTitles: string[];
};

export async function evaluateWebMcpToolAdapterMetadataContract(): Promise<WebMcpToolAdapterMetadataContractResult> {
  const [{ authoringAutomationController }, { WebMcpToolAdapter }] = (await Promise.all([
    import('/editor/src/services/automation/authoringAutomationController.ts'),
    import('/editor/src/services/webmcp/webMcpToolAdapter.ts'),
  ])) as [
    typeof import('../../../apps/editor/src/services/automation/authoringAutomationController'),
    typeof import('../../../apps/editor/src/services/webmcp/webMcpToolAdapter'),
  ];
  const unused = () => Promise.resolve({});
  const controller = new authoringAutomationController.AuthoringAutomationController({
    createPresentation: unused,
    getPresentationState: unused,
    importPowerPointFromUrl: unused,
    translateDeckAndNotes: unused,
    generateDeckDetailedDescription: unused,
    listAuthoringCatalog: unused,
    upsertSlideContent: () => Promise.reject(new Error('unused')),
    generateImage: unused,
    getSlidePreview: unused,
    getAiModelStatus: unused,
    prepareAiModels: () => Promise.resolve([]),
    searchMedia: unused,
    exportPresentation: unused,
  });
  const tools = new WebMcpToolAdapter(controller).createTools();

  return {
    readOnlyNames: tools.filter((tool) => tool.annotations?.readOnlyHint).map((tool) => tool.name),
    toolDescriptions: tools.map((tool) => tool.description),
    toolNames: tools.map((tool) => tool.name),
    toolTitles: tools.map((tool) => tool.title),
  };
}
