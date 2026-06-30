import { Bot, FileJson, ImagePlus, Languages, Play, Radar, SendHorizontal } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { imagePromptExamples, slidePromptExamples } from '../editor/promptRecipes';
import { TRANSLATION_LANGUAGE_OPTIONS } from '../editor/translationLanguages';

interface WebMcpToolLike {
  call?: (input: Record<string, unknown>) => unknown;
  description?: string;
  execute?: (input: Record<string, unknown>) => unknown;
  invoke?: (input: Record<string, unknown>) => unknown;
  name: string;
}

interface BrowserModelContext {
  getTools(options: { fromOrigins: string[] }): Promise<WebMcpToolLike[]>;
}

interface DemoStep {
  input: Record<string, unknown>;
  label: string;
  toolName: string;
}

const demoSteps: DemoStep[] = [
  {
    label: 'Create project',
    toolName: 'create_project',
    input: { name: 'WebMCP Demo Deck' },
  },
  {
    label: 'Generate slide',
    toolName: 'generate_slides',
    input: { prompt: slidePromptExamples[1] },
  },
  {
    label: 'Generate image',
    toolName: 'generate_image',
    input: {
      prompt: imagePromptExamples[1],
      width: 512,
      height: 512,
      steps: 4,
    },
  },
  {
    label: 'Translate deck',
    toolName: 'translate_text',
    input: { scope: 'deck', targetLanguage: 'pt' },
  },
  {
    label: 'Read snapshot',
    toolName: 'get_project_snapshot',
    input: {},
  },
];

function getBrowserModelContext() {
  if (typeof document === 'undefined') return undefined;
  return (document as Document & { modelContext?: BrowserModelContext }).modelContext;
}

function isWebMcpToolLikeArray(value: unknown): value is WebMcpToolLike[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    return typeof (item as { name?: unknown }).name === 'string';
  });
}

function getLocalDemoTools(iframe: HTMLIFrameElement) {
  const frameWindow = iframe.contentWindow;
  if (!frameWindow || !('localStudioWebMcpTools' in frameWindow)) return undefined;
  const tools = frameWindow.localStudioWebMcpTools;
  return isWebMcpToolLikeArray(tools) ? tools : undefined;
}

function callTool(tool: WebMcpToolLike, input: Record<string, unknown>) {
  const callable = tool.call ?? tool.execute ?? tool.invoke;
  if (!callable) throw new Error(`${tool.name} is not callable in this WebMCP runtime.`);
  return Promise.resolve(callable(input));
}

function formatPayload(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getDefaultCommandValue(step: DemoStep) {
  const primaryValue = step.input.name ?? step.input.prompt ?? step.input.targetLanguage;
  return typeof primaryValue === 'string' ? primaryValue : formatPayload(step.input);
}

function getCommandInput(step: DemoStep, value: string) {
  if (step.toolName === 'create_project') return { name: value };
  if (step.toolName === 'generate_slides') return { prompt: value };
  if (step.toolName === 'generate_image') return { ...step.input, prompt: value };
  if (step.toolName === 'translate_text') return { ...step.input, targetLanguage: value };
  return step.input;
}

function hasCommandInput(step: DemoStep) {
  return step.toolName !== 'get_project_snapshot';
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
      setStatus('No WebMCP runtime or same-origin demo tools found. Wait for the editor frame, then try again.');
      setTools([]);
      return;
    }
    setTools(discoveredTools);
    setStatus(
      modelContext
        ? `Discovered ${discoveredTools.length} tools through WebMCP.`
        : `Discovered ${discoveredTools.length} tools through the local demo bridge.`,
    );
    setLastResult(formatPayload(discoveredTools.map((tool) => ({ name: tool.name, description: tool.description }))));
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
            A host page discovers semantic tools from the editor iframe and calls the same automation layer
            used by the LocalStudio interface.
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
                ].filter(Boolean).join(' ')}
                disabled={isRunning}
                type="button"
                onClick={() => {
                  openStep(step);
                }}
              >
                <span className="webmcp-step-index">{index + 1}</span>
                {step.toolName === 'generate_image' ? <ImagePlus size={16} /> : null}
                {step.toolName === 'translate_text' ? <Languages size={16} /> : null}
                {step.toolName === 'get_project_snapshot' ? <FileJson size={16} /> : null}
                {step.toolName === 'generate_slides' || step.toolName === 'create_project' ? <Play size={16} /> : null}
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
                  {step.toolName === 'translate_text' ? (
                    <select
                      aria-label={`${step.label} command input`}
                      value={commandValues[step.toolName] ?? ''}
                      onChange={(event) => {
                        setCommandValues((current) => ({
                          ...current,
                          [step.toolName]: event.target.value,
                        }));
                      }}
                    >
                      {TRANSLATION_LANGUAGE_OPTIONS.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.label} ({language.code}) {language.flag}
                        </option>
                      ))}
                    </select>
                  ) : (
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
