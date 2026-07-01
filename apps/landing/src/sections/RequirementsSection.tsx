import { requirements } from '../content/requirements';

export function RequirementsSection() {
  return (
    <section id="requirements" className="requirements-section" aria-labelledby="requirements-title">
      <div className="section-heading">
        <p className="eyebrow">Requirements</p>
        <h2 id="requirements-title">Built for modern browser AI workflows.</h2>
        <p>
          LocalStudio runs in the browser, but the models and local project files still need the right browser surface
          and enough disk space.
        </p>
      </div>
      <div className="requirements-grid">
        {requirements.map(({ icon: Icon, title, copy }) => (
          <article className="requirement-card" key={title}>
            <Icon size={30} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
