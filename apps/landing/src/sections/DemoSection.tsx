import { demoSteps } from '../content/demoSteps';

export function DemoSection() {
  return (
    <section id="demo" className="demo-section" aria-labelledby="demo-title">
      <div className="section-heading">
        <p className="eyebrow">Watch the workflow</p>
        <h2 id="demo-title">From prompt to editable slide, still local.</h2>
        <p>
          LocalStudio.dev keeps the core creation loop in the browser: prompt, edit layers, translate, segment,
          generate, and save to disk.
        </p>
      </div>
      <div className="demo-grid">
        {demoSteps.map(({ icon: Icon, title, copy, proof }) => (
          <article className="demo-card" key={title}>
            <Icon size={28} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{copy}</p>
            <span>{proof}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
