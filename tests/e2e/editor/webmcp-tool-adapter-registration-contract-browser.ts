export type WebMcpToolAdapterRegistrationContractResult = {
  batchCleanupCount: number;
  duplicateBatchIgnored: boolean;
  duplicateIndividualIgnored: boolean;
  individualCleanupCount: number;
  individuallyRegisteredNames: string[];
  nonDuplicateErrorName: string;
  registeredNames: string[];
};

export async function evaluateWebMcpToolAdapterRegistrationContract(): Promise<WebMcpToolAdapterRegistrationContractResult> {
  const [{ authoringAutomationController }, { WebMcpToolAdapter }] = (await Promise.all([
    import('/editor/src/services/automation/authoringAutomationController.ts'),
    import('/editor/src/services/webmcp/webMcpToolAdapter.ts'),
  ])) as [
    typeof import('../../../apps/editor/src/services/automation/authoringAutomationController'),
    typeof import('../../../apps/editor/src/services/webmcp/webMcpToolAdapter'),
  ];
  const unused = () => Promise.resolve({});
  const adapter = new WebMcpToolAdapter(
    new authoringAutomationController.AuthoringAutomationController({
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
    }),
  );
  const registeredNames: string[] = [];
  let batchCleanupCount = 0;
  const unregisterBatch = adapter.register({
    registerTools: (registeredTools) => {
      registeredNames.push(...registeredTools.map((tool) => tool.name));
      return () => {
        batchCleanupCount += registeredTools.length;
      };
    },
  });
  unregisterBatch();
  const duplicateBatchIgnored = (() => {
    adapter.register({
      registerTools: () => {
        throw new DOMException('Duplicate tool name', 'InvalidStateError');
      },
    });
    return true;
  })();
  const individuallyRegisteredNames: string[] = [];
  let individualCleanupCount = 0;
  const unregisterIndividual = adapter.register({
    registerTool: (tool) => {
      individuallyRegisteredNames.push(tool.name);
      return () => {
        individualCleanupCount += 1;
      };
    },
  });
  unregisterIndividual();
  const duplicateIndividualIgnored = (() => {
    adapter.register({
      registerTool: () => {
        throw new DOMException('Duplicate tool name', 'InvalidStateError');
      },
    });
    return true;
  })();
  let nonDuplicateErrorName = '';
  try {
    adapter.register({
      registerTool: () => {
        throw new Error('registration failed');
      },
    });
  } catch (error) {
    nonDuplicateErrorName = error instanceof Error ? error.message : String(error);
  }
  return {
    batchCleanupCount,
    duplicateBatchIgnored,
    duplicateIndividualIgnored,
    individualCleanupCount,
    individuallyRegisteredNames,
    nonDuplicateErrorName,
    registeredNames,
  };
}
