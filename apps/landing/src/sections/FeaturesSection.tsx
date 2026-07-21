import { Layers3 } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { editorProof } from '../content/editorProof';
import { WebMcpSection } from './WebMcpSection';

export function FeaturesSection() {
  return (
    <section id="features" className="features-section" aria-labelledby="features-title">
      <div className="feature-details" aria-label="Feature details">
        <Reveal as="div" className="feature-panel" reveal="features-panel">
          <Layers3 size={34} aria-hidden="true" />
          <h2 id="features-title">An editor, not a toy demo.</h2>
          <p>
            LocalStudio already treats slides as layered documents: selectable objects, page controls, text editing,
            translation actions, imported assets, and local persistence are all part of the same editing surface.
          </p>
        </Reveal>
        <ul className="proof-list">
          {editorProof.map((item, index) => (
            <Reveal as="li" delay={index * 45} key={item} reveal="proof-item">
              {item}
            </Reveal>
          ))}
        </ul>
      </div>
      <WebMcpSection />
    </section>
  );
}
