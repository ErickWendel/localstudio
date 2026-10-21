// Mirrors Chrome 155's document.modelContext: asynchronous registration that rejects duplicates,
// abort-signal unregistration, discovery across same-origin frames, and object-only execution.
export function specModelContextInitScript() {
  type ExecuteCallback = (
    input: Record<string, unknown>,
    options: { signal: AbortSignal },
  ) => unknown;
  interface ToolDescriptor {
    annotations?: Record<string, boolean>;
    description: string;
    execute: ExecuteCallback;
    inputSchema?: Record<string, unknown>;
    name: string;
    title?: string;
  }
  interface RegistryEntry {
    tool: ToolDescriptor;
    window: Window;
  }
  interface SharedRuntime {
    registrationErrors: string[];
    registry: Map<string, RegistryEntry>;
  }
  type RuntimeWindow = Window & { __specModelContextRuntime?: SharedRuntime };

  const topWindow = window.top as RuntimeWindow;
  topWindow.__specModelContextRuntime ??= { registrationErrors: [], registry: new Map() };
  const runtime = topWindow.__specModelContextRuntime;

  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: {
      registerTool(tool: ToolDescriptor, options: { signal?: AbortSignal } = {}) {
        const registration = Promise.resolve().then(() => {
          if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          if (runtime.registry.has(tool.name)) {
            throw new DOMException('Duplicate tool name', 'InvalidStateError');
          }
          const entry = { tool, window };
          runtime.registry.set(tool.name, entry);
          options.signal?.addEventListener(
            'abort',
            () => {
              if (runtime.registry.get(tool.name) === entry) runtime.registry.delete(tool.name);
            },
            { once: true },
          );
        });
        registration.catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          runtime.registrationErrors.push(error instanceof Error ? error.message : String(error));
        });
        return registration;
      },
      getTools() {
        return Promise.resolve(
          [...runtime.registry.values()]
            .map(({ tool, window: owner }) => ({
              annotations: tool.annotations,
              description: tool.description,
              inputSchema: tool.inputSchema,
              name: tool.name,
              origin: owner.location.origin,
              title: tool.title,
              window: owner,
            }))
            .sort((left, right) => left.name.localeCompare(right.name)),
        );
      },
      async executeTool(registeredTool: { name: string }, inputObject?: unknown) {
        if (
          inputObject !== undefined &&
          (!inputObject || typeof inputObject !== 'object' || Array.isArray(inputObject))
        ) {
          throw new TypeError(
            "Failed to execute 'executeTool' on 'ModelContext': invalid input object: value is not an object",
          );
        }
        const entry = runtime.registry.get(registeredTool.name);
        if (!entry) throw new DOMException('Tool not found', 'NotFoundError');
        const result = await entry.tool.execute((inputObject ?? {}) as Record<string, unknown>, {
          signal: new AbortController().signal,
        });
        return JSON.stringify(result);
      },
    },
  });
}
