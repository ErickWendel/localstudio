export type WebMcpToolAdapterRegistrationContractResult = {
  individuallyRegisteredNames: string[];
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
    individuallyRegisteredNames,
    registeredNames,
  };
}
