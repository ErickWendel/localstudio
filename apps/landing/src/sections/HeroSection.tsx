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
          LocalStudio.dev turns existing presentations, image generation, translation, background removal, and local
          saving into one continuous slide workflow inside the browser.
        </p>
        <div className="hero-actions">
          <a className="header-cta hero-cta" href="/editor/">
            Open editor
            <ArrowRight size={18} aria-hidden="true" />
            <span className="hero-cta-snake" aria-hidden="true">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" focusable="false">
                <rect x="2" y="2" width="96" height="36" rx="6" pathLength={100} />
              </svg>
            </span>
          </a>
        </div>
      </Reveal>

      <Reveal as="div" className="workflow-frame-reveal" delay={120} reveal="workflow-frame">
        <WorkflowCarousel prefersReducedMotion={prefersReducedMotion} />
      </Reveal>
    </section>
  );
}
