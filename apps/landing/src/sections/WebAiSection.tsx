import { Bot, Lock, Sparkles } from 'lucide-react';

export function WebAiSection() {
  return (
    <section id="web-ai" className="web-ai-section" aria-labelledby="web-ai-title">
      <div>
        <p className="eyebrow">Why Web AI</p>
        <h2 id="web-ai-title">Model choice is a product feature.</h2>
      </div>
      <div className="web-ai-copy">
        <p>
          Chrome built-in APIs are the fast path when available. WebGPU models keep the app useful in other browsers
          and give power users explicit control over which local model backs each workflow.
        </p>
        <div className="ai-stack">
          <span>
            <Bot size={16} aria-hidden="true" />
            Built-in APIs
          </span>
          <span>
            <Sparkles size={16} aria-hidden="true" />
            External WebGPU models
          </span>
          <span>
            <Lock size={16} aria-hidden="true" />
            Browser-managed model cache
          </span>
        </div>
      </div>
    </section>
  );
}
