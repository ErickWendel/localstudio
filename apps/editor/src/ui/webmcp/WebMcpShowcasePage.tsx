import { FileJson, Play, Radar, SendHorizontal } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { type WebMcpShowcaseStep, webMcpShowcaseSections } from './webMcpShowcaseSteps';

const webMcpShowcaseSteps = webMcpShowcaseSections.flatMap((section) => section.steps);

interface WebMcpToolLike {
  call?: (input: Record<string, unknown>) => unknown;
  description?: string;
  execute?: (input: Record<string, unknown>) => unknown;
  invoke?: (input: Record<string, unknown>) => unknown;
  name: string;
}

interface BrowserModelContext {
  executeTool?: (tool: WebMcpToolLike, inputArguments: string) => unknown;
  getTools(options: { fromOrigins: string[] }): Promise<WebMcpToolLike[]>;
}

interface WebMcpOperationStatus {
  current?: number;
  detail?: string;
  error?: string;
  percentage?: number;
  result?: unknown;
  stage?: string;
  state: 'queued' | 'running' | 'completed' | 'failed';
  total?: number;
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

async function callTool(
  tool: WebMcpToolLike,
  input: Record<string, unknown>,
  useProtocolExecution: boolean,
) {
  const modelContext = useProtocolExecution ? getBrowserModelContext() : undefined;
  if (modelContext?.executeTool) {
    const result = await modelContext.executeTool(tool, JSON.stringify(input));
    if (typeof result !== 'string') return result;
    try {
      return JSON.parse(result) as unknown;
    } catch {
      return result;
    }
  }
  const callable = tool.call ?? tool.execute ?? tool.invoke;
  if (!callable) throw new Error(`${tool.name} is not callable in this WebMCP runtime.`);
  return callable(input);
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

function getOperationStatus(value: unknown): WebMcpOperationStatus | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return undefined;
  const status = data as {
    current?: unknown;
    detail?: unknown;
    error?: unknown;
    percentage?: unknown;
    result?: unknown;
    stage?: unknown;
    state?: unknown;
    total?: unknown;
  };
  if (!['queued', 'running', 'completed', 'failed'].includes(String(status.state))) {
    return undefined;
  }
  return {
    ...(typeof status.current === 'number' ? { current: status.current } : {}),
    ...(typeof status.detail === 'string' ? { detail: status.detail } : {}),
    ...(typeof status.error === 'string' ? { error: status.error } : {}),
    ...(typeof status.percentage === 'number' ? { percentage: status.percentage } : {}),
    ...(status.result !== undefined ? { result: status.result } : {}),
    ...(typeof status.stage === 'string' ? { stage: status.stage } : {}),
    state: status.state as WebMcpOperationStatus['state'],
    ...(typeof status.total === 'number' ? { total: status.total } : {}),
  };
}

export function WebMcpShowcasePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stepButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [tools, setTools] = useState<WebMcpToolLike[]>([]);
  const [discoveryStatus, setDiscoveryStatus] = useState('Ready to discover page tools.');
  const [actionStatuses, setActionStatuses] = useState<Record<string, string>>({});
  const [actionResults, setActionResults] = useState<Record<string, string>>({});
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
    setActiveStepName((current) => (current === step.toolName ? undefined : step.toolName));
    setFocusedStepName(step.toolName);
  }

  function setActionStatus(toolName: string, nextStatus: string) {
    setActionStatuses((current) => ({ ...current, [toolName]: nextStatus }));
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
      setDiscoveryStatus('Editor iframe is not ready yet.');
      setTools([]);
      return;
    }

    setDiscoveryStatus('Discovering tools from LocalStudio...');
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
      setDiscoveryStatus(
        'No WebMCP runtime or same-origin demo tools found. Wait for the editor frame, then try again.',
      );
      setTools([]);
      return;
    }
    setTools(discoveredTools);
    setUseProtocolExecution(usedProtocolTools);
    setDiscoveryStatus(
      usedProtocolTools
        ? `Discovered ${discoveredTools.length} tools through WebMCP.`
        : `Discovered ${discoveredTools.length} tools through the local demo bridge.`,
    );
  }

  async function runStep(step: WebMcpShowcaseStep, commandValue: string) {
    const tool = toolsByName.get(step.toolName);
    if (!tool) {
      setActionStatus(step.toolName, `${step.toolName} has not been discovered yet.`);
      return;
    }

    setIsRunning(true);
    setActionStatus(step.toolName, `Running ${step.label}...`);
    setActionResults((current) => ({ ...current, [step.toolName]: '' }));
    try {
      const input = getCommandInput(step, commandValue);
      const result = await callTool(tool, input, useProtocolExecution);
      setActionResults((current) => ({ ...current, [step.toolName]: formatPayload(result) }));
      const failure = getToolFailure(result);
      if (failure) {
        setActionStatus(step.toolName, `${step.label} failed: ${failure}`);
        return;
      }
      const operationId = getOperationId(result);
      if (operationId && step.toolName !== 'get_operation_status') {
        setCommandValues((current) => ({
          ...current,
          get_operation_status: formatPayload({ operationId, waitForChangeMs: 1000 }),
        }));
        const operationTool = toolsByName.get('get_operation_status');
        if (!operationTool) {
          setActionStatus(
            step.toolName,
            `${step.label} started. Use Get operation status to follow its progress.`,
          );
          return;
        }
        setActionStatus(
          step.toolName,
          `${step.label} started. Waiting for the operation to finish.`,
        );
        while (true) {
          const operationResult = await callTool(
            operationTool,
            { operationId, waitForChangeMs: 1000 },
            useProtocolExecution,
          );
          setActionResults((current) => ({
            ...current,
            [step.toolName]: formatPayload(operationResult),
          }));
          const operationFailure = getToolFailure(operationResult);
          if (operationFailure) throw new Error(operationFailure);
          const operationStatus = getOperationStatus(operationResult);
          if (!operationStatus) throw new Error('The operation returned an invalid status.');
          if (operationStatus.state === 'completed') {
            setActionStatus(step.toolName, `${step.label} completed.`);
            return;
          }
          if (operationStatus.state === 'failed') {
            setActionStatus(
              step.toolName,
              `${step.label} failed: ${operationStatus.error ?? 'The operation failed.'}`,
            );
            return;
          }
          const stage = operationStatus.stage ? `: ${operationStatus.stage}` : '';
          const percentage =
            operationStatus.percentage === undefined ? '' : ` (${operationStatus.percentage}%)`;
          const count =
            operationStatus.current !== undefined && operationStatus.total !== undefined
              ? ` ${operationStatus.current}/${operationStatus.total}`
              : '';
          const detail = operationStatus.detail ? ` — ${operationStatus.detail}` : '';
          setActionStatus(
            step.toolName,
            `${step.label} is ${operationStatus.state}${stage}${percentage}${count}${detail}.`,
          );
        }
      }
      setActionStatus(step.toolName, `${step.label} completed.`);
    } catch (error) {
      setActionStatus(
        step.toolName,
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
          <span className="webmcp-status">{discoveryStatus}</span>
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

        {tools.length > 0 ? (
          <div className="webmcp-workflow" aria-label="Demo workflow">
            {webMcpShowcaseSections.map((section) => (
              <section
                aria-labelledby={`webmcp-section-${section.id}`}
                className="webmcp-workflow-section"
                key={section.id}
              >
                <header className="webmcp-workflow-section-heading">
                  <div>
                    <h2 id={`webmcp-section-${section.id}`}>{section.title}</h2>
                    <p>{section.description}</p>
                  </div>
                  <span>{section.steps.length}</span>
                </header>
                <div className="webmcp-workflow-section-tools">
                  {section.steps.map((step) => (
                    <div className="webmcp-step" key={step.toolName}>
                      <button
                        ref={(element) => {
                          stepButtonRefs.current[step.toolName] = element;
                        }}
                        aria-expanded={activeStepName === step.toolName}
                        aria-label={step.label}
                        className={[
                          'webmcp-step-button',
                          activeStepName === step.toolName ? 'webmcp-step-button-active' : '',
                          focusedStepName === step.toolName ? 'webmcp-step-button-focused' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        type="button"
                        onClick={() => {
                          openStep(step);
                        }}
                      >
                        {step.toolName === 'get_presentation_state' ? <FileJson size={16} /> : null}
                        {step.toolName !== 'get_presentation_state' ? <Play size={16} /> : null}
                        <span>{step.label}</span>
                      </button>
                      {actionStatuses[step.toolName] ? (
                        <p className="webmcp-step-status" role="status" aria-live="polite">
                          {actionStatuses[step.toolName]}
                        </p>
                      ) : null}
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
                          <button
                            aria-label={`Send ${step.label}`}
                            disabled={isRunning}
                            type="submit"
                          >
                            <SendHorizontal size={15} />
                          </button>
                        </form>
                      ) : null}
                      {activeStepName === step.toolName && actionResults[step.toolName] ? (
                        <details className="webmcp-step-result-shell" open>
                          <summary>Result</summary>
                          <pre aria-label={`${step.label} result`} className="webmcp-step-result">
                            {actionResults[step.toolName]}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </section>

      <section className="webmcp-editor-frame" aria-label="LocalStudio editor frame">
        <iframe ref={iframeRef} src={editorSrc} title="LocalStudio editor WebMCP demo" />
      </section>
    </main>
  );
}
