import { ArrowRight } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { WorkflowCarousel } from '../components/WorkflowCarousel';

export function HeroSection({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <section id="top" className="hero-section" aria-labelledby="hero-title">
      <Reveal as="div" className="hero-copy" reveal="hero-copy">
        <p className="eyebrow">Browser-native Canva-style editor</p>
        <h1 id="hero-title">Design slides with local AI, then keep editing.</h1>
        <p className="hero-subtitle">
          LocalStudio.dev turns prompt, image generation, translation, background removal, and local saving into one
          continuous slide workflow inside the browser.
        </p>
        <div className="hero-actions">
          <a className="secondary-action" href="/editor/">
            Launch editor
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="hero-status-row" aria-label="LocalStudio capabilities">
          <span>Beta</span>
          <span>Live editor</span>
          <span>Browser API</span>
          <span>WebGPU models</span>
          <span>Local folder</span>
        </div>
      </Reveal>

      <Reveal as="div" className="workflow-frame-reveal" delay={120} reveal="workflow-frame">
        <WorkflowCarousel prefersReducedMotion={prefersReducedMotion} />
      </Reveal>
    </section>
  );
}
