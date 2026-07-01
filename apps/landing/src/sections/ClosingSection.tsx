import { ArrowRight } from 'lucide-react';
import { Reveal } from '../components/Reveal';

export function ClosingSection() {
  return (
    <section className="closing-section" aria-labelledby="closing-title">
      <Reveal as="h2" reveal="closing-heading">
        <span id="closing-title">Try the browser-native editor.</span>
      </Reveal>
      <Reveal as="div" className="closing-action" delay={80} reveal="closing-cta">
        <a className="primary-action" href="/editor/">
          Open LocalStudio.dev
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </Reveal>
    </section>
  );
}
