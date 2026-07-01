import { Layers3 } from 'lucide-react';
import { editorProof } from '../content/editorProof';

export function FeaturesSection() {
  return (
    <section id="features" className="features-section" aria-labelledby="features-title">
      <div className="feature-panel">
        <Layers3 size={34} aria-hidden="true" />
        <h2 id="features-title">An editor, not a toy demo.</h2>
        <p>
          LocalStudio already treats slides as layered documents: selectable objects, page controls, text editing,
          translation actions, imported assets, and local persistence are all part of the same editing surface.
        </p>
      </div>
      <ul className="proof-list">
        {editorProof.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
