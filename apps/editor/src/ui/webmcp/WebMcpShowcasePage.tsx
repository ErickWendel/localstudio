import { Bot, FileJson, Play, Radar, SendHorizontal } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { type WebMcpShowcaseStep, webMcpShowcaseSteps } from './webMcpShowcaseSteps';

interface WebMcpToolLike {
  call?: (input: Record<string, unknown>) => unknown;
  description?: string;
  execute?: (input: Record<string, unknown>) => unknown;
  invoke?: (input: Record<string, unknown>) => unknown;
  name: string;
}

interface BrowserModelContext {
  executeTool?: (tool: WebMcpToolLike, input: Record<string, unknown>) => unknown;
  getTools(options: { fromOrigins: string[] }): Promise<WebMcpToolLike[]>;
}

function getBrowserModelContext() {
  if (typeof document === 'undefined') return undefined;
  return (document as Document & { modelContext?: BrowserModelContext }).modelContext;
}

function isWebMcpToolLikeArray(value: unknown): value is WebMcpToolLike[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object') return false;
      return typeof (item as { name?: unknown }).name === 'string';
    })
  );
}

function getLocalDemoTools(iframe: HTMLIFrameElement) {
  const frameWindow = iframe.contentWindow;
  if (!frameWindow || !('localStudioWebMcpTools' in frameWindow)) return undefined;
  const tools = frameWindow.localStudioWebMcpTools;
  return isWebMcpToolLikeArray(tools) ? tools : undefined;
}

async function waitForLocalDemoTools(iframe: HTMLIFrameElement) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const tools = getLocalDemoTools(iframe);
    if (tools?.length) return tools;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
  return undefined;
}

function callTool(
  tool: WebMcpToolLike,
  input: Record<string, unknown>,
  useProtocolExecution: boolean,
) {
  const modelContext = useProtocolExecution ? getBrowserModelContext() : undefined;
  if (modelContext?.executeTool) return Promise.resolve(modelContext.executeTool(tool, input));
  const callable = tool.call ?? tool.execute ?? tool.invoke;
  if (!callable) throw new Error(`${tool.name} is not callable in this WebMCP runtime.`);
  return Promise.resolve(callable(input));
}

function formatPayload(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getDefaultCommandValue(step: WebMcpShowcaseStep) {
  const primaryValue = step.input.name;
  return step.inputKind === 'name' && typeof primaryValue === 'string'
    ? primaryValue
    : formatPayload(step.input);
}

function getCommandInput(step: WebMcpShowcaseStep, value: string) {
  if (step.inputKind === 'name') return { name: value };
  return JSON.parse(value) as Record<string, unknown>;
}

function getOperationId(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return undefined;
  const operationId = (data as { operationId?: unknown }).operationId;
  return typeof operationId === 'string' ? operationId : undefined;
}

function getToolFailure(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const result = value as { errorCode?: unknown; message?: unknown; ok?: unknown };
  if (result.ok !== false) return undefined;
  if (typeof result.message === 'string') return result.message;
  if (typeof result.errorCode === 'string') return result.errorCode;
  return 'The tool returned an unsuccessful result.';
}

export function WebMcpShowcasePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stepButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [tools, setTools] = useState<WebMcpToolLike[]>([]);
  const [status, setStatus] = useState('Ready to discover page tools.');
  const [lastResult, setLastResult] = useState<string>('{}');
  const [isRunning, setIsRunning] = useState(false);
  const [useProtocolExecution, setUseProtocolExecution] = useState(false);
  const [activeStepName, setActiveStepName] = useState<string | undefined>();
  const [focusedStepName, setFocusedStepName] = useState<string | undefined>();
  const [commandValues, setCommandValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      webMcpShowcaseSteps.map((step) => [step.toolName, getDefaultCommandValue(step)]),
    ),
  );
  const editorSrc = '/editor/?webmcp=1&newProject=1';
  const toolsByName = useMemo(() => new Map(tools.map((tool) => [tool.name, tool])), [tools]);

  function openStep(step: WebMcpShowcaseStep) {
    setActiveStepName(step.toolName);
    setFocusedStepName(step.toolName);
  }

  function focusStep(toolName: string) {
    setActiveStepName(toolName);
    setFocusedStepName(toolName);
    stepButtonRefs.current[toolName]?.focus();
    window.requestAnimationFrame(() => {
      const stepButton = stepButtonRefs.current[toolName];
      stepButton?.focus();
      stepButton?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  async function discoverTools() {
    const iframe = iframeRef.current;
    if (!iframe) {
      setStatus('Editor iframe is not ready yet.');
      setTools([]);
      return;
    }

    setStatus('Discovering tools from LocalStudio...');
    const modelContext = getBrowserModelContext();
    const iframeOrigin = new URL(iframe.src).origin;
    const protocolTools = modelContext
      ? await modelContext.getTools({ fromOrigins: [iframeOrigin] })
      : undefined;
    const discoveredTools = protocolTools?.length
      ? protocolTools
      : await waitForLocalDemoTools(iframe);
    const usedProtocolTools = Boolean(protocolTools?.length);
    if (!discoveredTools) {
      setStatus(
        'No WebMCP runtime or same-origin demo tools found. Wait for the editor frame, then try again.',
      );
      setTools([]);
      return;
    }
    setTools(discoveredTools);
    setUseProtocolExecution(usedProtocolTools);
    setStatus(
      usedProtocolTools
        ? `Discovered ${discoveredTools.length} tools through WebMCP.`
        : `Discovered ${discoveredTools.length} tools through the local demo bridge.`,
    );
    setLastResult(
      formatPayload(
        discoveredTools.map((tool) => ({ name: tool.name, description: tool.description })),
      ),
    );
  }

  async function runStep(step: WebMcpShowcaseStep, commandValue: string) {
    const tool = toolsByName.get(step.toolName);
    if (!tool) {
      setStatus(`${step.toolName} has not been discovered yet.`);
      return;
    }

    setIsRunning(true);
    setStatus(`Running ${step.label}...`);
    try {
      const input = getCommandInput(step, commandValue);
      const result = await callTool(tool, input, useProtocolExecution);
      setLastResult(formatPayload(result));
      const failure = getToolFailure(result);
      setStatus(failure ? `${step.label} failed: ${failure}` : `${step.label} completed.`);
      const operationId = getOperationId(result);
      if (operationId) {
        setCommandValues((current) => ({
          ...current,
          get_operation_status: formatPayload({ operationId, waitForChangeMs: 1000 }),
        }));
      }
    } catch (error) {
      setStatus(
        `${step.label} failed: ${error instanceof Error ? error.message : 'Unknown error.'}`,
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="webmcp-page">
      <section className="webmcp-control-plane" aria-label="WebMCP control plane">
        <div className="webmcp-brand-row">
          <span className="webmcp-signal" aria-hidden="true">
            <Radar size={18} />
          </span>
          <span>LocalStudio.dev</span>
        </div>
        <div className="webmcp-hero">
          <p className="webmcp-kicker">Browser agent surface</p>
          <h1>WebMCP showcase</h1>
          <p>
            A host page discovers semantic tools from the editor iframe and calls the same
            automation layer used by the LocalStudio interface.
          </p>
        </div>

        <div className="webmcp-action-row">
          <button
            className="webmcp-primary-action"
            disabled={isRunning}
            type="button"
            onClick={() => {
              void discoverTools();
            }}
          >
            <Radar size={16} />
            <span>Discover tools</span>
          </button>
          <span className="webmcp-status">{status}</span>
        </div>

        <div className="webmcp-tool-list" aria-label="Discovered tools">
          {tools.length > 0 ? (
            tools.map((tool) => (
              <button
                className="webmcp-tool-pill"
                key={tool.name}
                type="button"
                onClick={() => {
                  focusStep(tool.name);
                }}
              >
                {tool.name}
              </button>
            ))
          ) : (
            <span className="webmcp-empty-tools">No tools discovered</span>
          )}
        </div>

        <div className="webmcp-workflow" aria-label="Demo workflow">
          {webMcpShowcaseSteps.map((step, index) => (
            <div className="webmcp-step" key={step.toolName}>
              <button
                ref={(element) => {
                  stepButtonRefs.current[step.toolName] = element;
                }}
                aria-label={step.label}
                className={[
                  'webmcp-step-button',
                  activeStepName === step.toolName ? 'webmcp-step-button-active' : '',
                  focusedStepName === step.toolName ? 'webmcp-step-button-focused' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                disabled={isRunning}
                type="button"
                onClick={() => {
                  openStep(step);
                }}
              >
                <span className="webmcp-step-index">{index + 1}</span>
                {step.toolName === 'get_presentation_state' ? <FileJson size={16} /> : null}
                {step.toolName !== 'get_presentation_state' ? <Play size={16} /> : null}
                <span>{step.label}</span>
              </button>
              {activeStepName === step.toolName ? (
                <form
                  className="webmcp-step-command"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runStep(step, commandValues[step.toolName] ?? '');
                  }}
                >
                  {step.inputKind === 'name' ? (
                    <input
                      aria-label={`${step.label} command input`}
                      value={commandValues[step.toolName] ?? ''}
                      onChange={(event) => {
                        setCommandValues((current) => ({
                          ...current,
                          [step.toolName]: event.target.value,
                        }));
                      }}
                    />
                  ) : (
                    <textarea
                      aria-label={`${step.label} command input`}
                      rows={5}
                      value={commandValues[step.toolName] ?? ''}
                      onChange={(event) => {
                        setCommandValues((current) => ({
                          ...current,
                          [step.toolName]: event.target.value,
                        }));
                      }}
                    />
                  )}
                  <button aria-label={`Send ${step.label}`} disabled={isRunning} type="submit">
                    <SendHorizontal size={15} />
                  </button>
                </form>
              ) : null}
            </div>
          ))}
        </div>

        <section className="webmcp-result-panel" aria-label="Last WebMCP result">
          <div className="webmcp-result-heading">
            <Bot size={16} />
            <span>Last result</span>
          </div>
          <pre>{lastResult}</pre>
        </section>
      </section>

      <section className="webmcp-editor-frame" aria-label="LocalStudio editor frame">
        <iframe ref={iframeRef} src={editorSrc} title="LocalStudio editor WebMCP demo" />
      </section>
    </main>
  );
}
