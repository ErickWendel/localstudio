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
  const { WebMcpToolAdapter } = (await import(
    '/editor/src/services/webmcp/webMcpToolAdapter.ts'
  )) as typeof import('../../../apps/editor/src/services/webmcp/webMcpToolAdapter');

  const adapter = new WebMcpToolAdapter({
    createProject: () => ({ data: {}, ok: true }),
    generateImage: () => ({ data: {}, ok: true }),
    generateSlides: () => ({ data: {}, ok: true }),
    getProjectSnapshot: () => ({ data: {}, ok: true }),
    translateText: () => ({ data: {}, ok: true }),
  });
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
        throw new DOMException('Duplicate tool name: create_project', 'InvalidStateError');
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
        throw new DOMException('Duplicate tool name: create_project', 'InvalidStateError');
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
