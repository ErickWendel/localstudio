import { FeatureMedia } from '../components/FeatureMedia';
import { featureShowcases } from '../content/featureShowcases';

export function ShowcaseSection() {
  return (
    <section id="showcase" className="showcase-section" aria-labelledby="showcase-title">
      <div className="section-heading">
        <p className="eyebrow">Feature showcase</p>
        <h2 id="showcase-title">Every AI action returns to the editor.</h2>
        <p>
          The product story is not five separate demos. Each feature keeps the deck editable and moves the same local
          project forward.
        </p>
      </div>
      <div className="showcase-list">
        {featureShowcases.map((feature, index) => (
          <article className={index % 2 === 1 ? 'showcase-row reverse' : 'showcase-row'} key={feature.id}>
            <div className="showcase-copy">
              <p className="eyebrow">{feature.eyebrow}</p>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <ul>
                {feature.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
            <FeatureMedia feature={feature.id} />
          </article>
        ))}
      </div>
    </section>
  );
}
