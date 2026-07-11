export type WebMcpToolAdapterMetadataContractResult = {
  toolDescriptions: string[];
  toolNames: string[];
};

export async function evaluateWebMcpToolAdapterMetadataContract(): Promise<WebMcpToolAdapterMetadataContractResult> {
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
  const tools = adapter.createTools();

  return {
    toolDescriptions: tools.map((tool) => tool.description),
    toolNames: tools.map((tool) => tool.name),
  };
}
