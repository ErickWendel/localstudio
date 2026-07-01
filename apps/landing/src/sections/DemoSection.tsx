import { Reveal } from '../components/Reveal';
import { demoSteps } from '../content/demoSteps';

export function DemoSection() {
  return (
    <section id="demo" className="demo-section" aria-labelledby="demo-title">
      <Reveal as="div" className="section-heading" reveal="demo-heading">
        <p className="eyebrow">Watch the workflow</p>
        <h2 id="demo-title">From prompt to editable slide, still local.</h2>
        <p>
          LocalStudio.dev keeps the core creation loop in the browser: prompt, edit layers, translate, segment,
          generate, and save to disk.
        </p>
      </Reveal>
      <div className="demo-grid">
        {demoSteps.map(({ icon: Icon, title, copy, proof }, index) => (
          <Reveal as="article" className="demo-card" delay={index * 45} key={title} reveal="demo-card">
            <Icon size={28} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{copy}</p>
            <span>{proof}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
