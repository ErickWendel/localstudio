import { ArrowRight } from 'lucide-react';

export function ClosingSection() {
  return (
    <section className="closing-section" aria-labelledby="closing-title">
      <h2 id="closing-title">Try the browser-native editor.</h2>
      <a className="primary-action" href="/editor/">
        Open LocalStudio.dev
        <ArrowRight size={18} aria-hidden="true" />
      </a>
    </section>
  );
}
