import { Bot, Lock, Sparkles } from 'lucide-react';
import { Reveal } from '../components/Reveal';

export function WebAiSection() {
  return (
    <section id="web-ai" className="web-ai-section" aria-labelledby="web-ai-title">
      <Reveal as="div" reveal="web-ai-heading">
        <p className="eyebrow">Why Web AI</p>
        <h2 id="web-ai-title">Model choice is a product feature.</h2>
      </Reveal>
      <Reveal as="div" className="web-ai-copy" delay={80} reveal="web-ai-copy">
        <p>
          Chrome built-in APIs are the fast path when available. WebGPU models keep the app useful in other browsers
          and give power users explicit control over which local model backs each workflow.
        </p>
        <Reveal as="div" className="ai-stack" delay={160} reveal="web-ai-stack">
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
        </Reveal>
      </Reveal>
    </section>
  );
}
