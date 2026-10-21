interface NativeModelContext {
  executeTool(tool: unknown, input: Record<string, unknown>): Promise<string>;
  getTools(): Promise<Array<{ annotations?: Record<string, boolean>; name: string }>>;
}

interface NativeToolSummary {
  annotations?: Record<string, boolean>;
  name: string;
}

// Each method runs inside the page through page.evaluate, so it must stay self-contained.
export const nativeModelContextBrowser = {
  listTools: async (): Promise<NativeToolSummary[]> => {
    const { modelContext } = document as Document & { modelContext: NativeModelContext };
    const tools = await modelContext.getTools();
    return tools.map(({ annotations, name }) => ({ annotations, name }));
  },
  executeTool: async ({
    input,
    name,
  }: {
    input: Record<string, unknown>;
    name: string;
  }): Promise<unknown> => {
    const { modelContext } = document as Document & { modelContext: NativeModelContext };
    const tool = (await modelContext.getTools()).find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`Missing native WebMCP tool: ${name}`);
    return JSON.parse(await modelContext.executeTool(tool, input)) as unknown;
  },
};
