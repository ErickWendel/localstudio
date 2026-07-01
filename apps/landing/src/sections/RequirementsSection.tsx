import { Reveal } from '../components/Reveal';
import { requirements } from '../content/requirements';

export function RequirementsSection() {
  return (
    <section id="requirements" className="requirements-section" aria-labelledby="requirements-title">
      <Reveal as="div" className="section-heading" reveal="requirements-heading">
        <p className="eyebrow">Requirements</p>
        <h2 id="requirements-title">Built for modern browser AI workflows.</h2>
        <p>
          LocalStudio runs in the browser, but the models and local project files still need the right browser surface
          and enough disk space.
        </p>
      </Reveal>
      <div className="requirements-grid">
        {requirements.map(({ icon: Icon, title, copy }, index) => (
          <Reveal as="article" className="requirement-card" delay={index * 55} key={title} reveal="requirement-card">
            <span className="requirement-status-check" aria-hidden="true" />
            <Icon size={30} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{copy}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
