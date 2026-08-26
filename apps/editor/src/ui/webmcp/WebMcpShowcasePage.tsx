import { Bot, FileJson, Play, Radar, SendHorizontal } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

interface WebMcpToolLike {
  call?: (input: Record<string, unknown>) => unknown;
  description?: string;
  execute?: (input: Record<string, unknown>) => unknown;
  invoke?: (input: Record<string, unknown>) => unknown;
  name: string;
}

interface BrowserModelContext {
  executeTool?: (tool: WebMcpToolLike, inputArgsJson: string) => unknown;
  getTools(options: { fromOrigins: string[] }): Promise<WebMcpToolLike[]>;
}

interface DemoStep {
  input: Record<string, unknown>;
  label: string;
  toolName: string;
}

const demoSteps: DemoStep[] = [
  {
    label: 'Create presentation',
    toolName: 'create_presentation',
    input: { name: 'WebMCP Demo Deck' },
  },
  {
    label: 'Upsert slide',
    toolName: 'upsert_slide_content',
    input: {
      requestId: 'webmcp-showcase-slide-1',
      slideNumber: 1,
      mode: 'replace',
      slide: {
        name: 'Agent-native presentations',
        background: { type: 'color', color: '#050D10' },
      },
      elements: [
        {
          elementId: 'showcase-title',
          type: 'text',
          frame: { x: 180, y: 260, width: 1560, height: 220 },
          zIndex: 1,
          content: { text: 'Presentations become agent-native' },
          style: {
            fontFamily: 'Orbitron',
            fontSize: 88,
            fontWeight: 800,
            color: '#37FD76',
            align: 'center',
          },
        },
        {
          elementId: 'showcase-body',
          type: 'text',
          frame: { x: 360, y: 560, width: 1200, height: 120 },
          zIndex: 2,
          content: {
            text: 'Create, inspect, localize, export, and publish through browser-native tools.',
          },
          style: {
            fontFamily: 'Open Sans',
            fontSize: 42,
            fontWeight: 600,
            color: '#FFFFFF',
            align: 'center',
          },
        },
      ],
    },
  },
  {
    label: 'Read presentation state',
    toolName: 'get_presentation_state',
    input: { detail: 'elements', slideNumbers: [1] },
  },
];

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

function callTool(
  tool: WebMcpToolLike,
  input: Record<string, unknown>,
  modelContext = getBrowserModelContext(),
) {
  if (modelContext?.executeTool)
    return Promise.resolve(modelContext.executeTool(tool, JSON.stringify(input)));
  const callable = tool.call ?? tool.execute ?? tool.invoke;
  if (!callable) throw new Error(`${tool.name} is not callable in this WebMCP runtime.`);
  return Promise.resolve(callable(input));
}

function formatPayload(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getDefaultCommandValue(step: DemoStep) {
  const primaryValue = step.input.name;
  return typeof primaryValue === 'string' ? primaryValue : formatPayload(step.input);
}

function getCommandInput(step: DemoStep, value: string) {
  if (step.toolName === 'create_presentation') return { name: value };
  if (step.toolName === 'upsert_slide_content') {
    return JSON.parse(value) as Record<string, unknown>;
  }
  return step.input;
}

function hasCommandInput(step: DemoStep) {
  return step.toolName !== 'get_presentation_state';
}

export function WebMcpShowcasePage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stepButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [tools, setTools] = useState<WebMcpToolLike[]>([]);
  const [status, setStatus] = useState('Ready to discover page tools.');
  const [lastResult, setLastResult] = useState<string>('{}');
  const [isRunning, setIsRunning] = useState(false);
  const [activeStepName, setActiveStepName] = useState<string | undefined>();
  const [focusedStepName, setFocusedStepName] = useState<string | undefined>();
  const [commandValues, setCommandValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(demoSteps.map((step) => [step.toolName, getDefaultCommandValue(step)])),
  );
  const editorSrc = '/editor/?webmcp=1&newProject=1';
  const toolsByName = useMemo(() => new Map(tools.map((tool) => [tool.name, tool])), [tools]);

  function openStep(step: DemoStep) {
    setActiveStepName(step.toolName);
    setFocusedStepName(step.toolName);
    if (!hasCommandInput(step)) void runStep(step);
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
    const fallbackTools = getLocalDemoTools(iframe);
    const discoveredTools = modelContext
      ? await modelContext.getTools({ fromOrigins: [iframeOrigin] })
      : fallbackTools;
    if (!discoveredTools) {
      setStatus(
        'No WebMCP runtime or same-origin demo tools found. Wait for the editor frame, then try again.',
      );
      setTools([]);
      return;
    }
    setTools(discoveredTools);
    setStatus(
      modelContext
        ? `Discovered ${discoveredTools.length} tools through WebMCP.`
        : `Discovered ${discoveredTools.length} tools through the local demo bridge.`,
    );
    setLastResult(
      formatPayload(
        discoveredTools.map((tool) => ({ name: tool.name, description: tool.description })),
      ),
    );
  }

  async function runStep(step: DemoStep, input = step.input) {
    const tool = toolsByName.get(step.toolName);
    if (!tool) {
      setStatus(`${step.toolName} has not been discovered yet.`);
      return;
    }

    setIsRunning(true);
    setStatus(`Running ${step.label}...`);
    try {
      const result = await callTool(tool, input);
      setStatus(`${step.label} completed.`);
      setLastResult(formatPayload(result));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${step.label} failed.`);
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
          {demoSteps.map((step, index) => (
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
              {activeStepName === step.toolName && hasCommandInput(step) ? (
                <form
                  className="webmcp-step-command"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void runStep(step, getCommandInput(step, commandValues[step.toolName] ?? ''));
                  }}
                >
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
