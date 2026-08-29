import { FileJson, Play, Radar, SendHorizontal } from 'lucide-react';
import { webMcpShowcaseCatalog } from './webMcpShowcaseSteps';
import { useWebMcpShowcase } from './useWebMcpShowcase';

export function WebMcpShowcasePage() {
  const {
    actionResults,
    actionStatuses,
    activeStepName,
    commandValues,
    discoverTools,
    discoveryStatus,
    focusStep,
    focusedStepName,
    iframeRef,
    isRunning,
    openStep,
    runStep,
    selectedOptionIds,
    setCommandValue,
    selectStepOption,
    stepButtonRefs,
    tools,
  } = useWebMcpShowcase();

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
            {webMcpShowcaseCatalog.sections.map((section) => (
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
                  {section.steps.map((step) => {
                    const isActive = activeStepName === step.toolName;
                    const selectedOptionId = selectedOptionIds[step.toolName];
                    const showCommand = !step.options || Boolean(selectedOptionId);
                    return (
                      <div className="webmcp-step" key={step.toolName}>
                        <button
                          ref={(element) => {
                            stepButtonRefs.current[step.toolName] = element;
                          }}
                          aria-expanded={isActive}
                          aria-label={step.label}
                          className={[
                            'webmcp-step-button',
                            isActive ? 'webmcp-step-button-active' : '',
                            focusedStepName === step.toolName
                              ? 'webmcp-step-button-focused'
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          type="button"
                          onClick={() => {
                            openStep(step);
                          }}
                        >
                          {step.toolName === 'get_presentation_state' ? (
                            <FileJson size={16} />
                          ) : (
                            <Play size={16} />
                          )}
                          <span>{step.label}</span>
                        </button>
                        {isActive ? (
                          <div className="webmcp-step-body">
                          {actionStatuses[step.toolName] ? (
                            <p className="webmcp-step-status" role="status" aria-live="polite">
                              {actionStatuses[step.toolName]}
                            </p>
                          ) : null}
                          {step.options ? (
                            <div
                              aria-label={`${step.label} options`}
                              className="webmcp-step-options"
                              role="group"
                            >
                              {step.options.map((option) => (
                                <button
                                  aria-pressed={selectedOptionId === option.id}
                                  className="webmcp-step-option"
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    selectStepOption(step, option);
                                  }}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {showCommand ? (
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
                                    setCommandValue(step.toolName, event.target.value);
                                  }}
                                />
                              ) : (
                                <textarea
                                  aria-label={`${step.label} command input`}
                                  rows={5}
                                  value={commandValues[step.toolName] ?? ''}
                                  onChange={(event) => {
                                    setCommandValue(step.toolName, event.target.value);
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
                          {actionResults[step.toolName] ? (
                            <details className="webmcp-step-result-shell" open>
                              <summary>Result</summary>
                              <pre
                                aria-label={`${step.label} result`}
                                className="webmcp-step-result"
                              >
                                {actionResults[step.toolName]}
                              </pre>
                            </details>
                          ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </section>

      <section className="webmcp-editor-frame" aria-label="LocalStudio editor frame">
        <iframe
          ref={iframeRef}
          src="/editor/?webmcp=1&newProject=1"
          title="LocalStudio editor WebMCP demo"
        />
      </section>
    </main>
  );
}
