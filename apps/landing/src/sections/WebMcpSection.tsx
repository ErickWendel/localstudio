import { ArrowRight } from 'lucide-react';
import { Reveal } from '../components/Reveal';

export function WebMcpSection() {
  return (
    <section id="webmcp" className="webmcp-section" aria-labelledby="webmcp-title">
      <div className="showcase-row">
        <Reveal as="div" className="showcase-copy" reveal="webmcp-copy">
          <p className="eyebrow">WebMCP showcase</p>
          <h2 id="webmcp-title">A host page can drive the editor through browser tools.</h2>
          <p>
            WebMCP exposes LocalStudio actions as semantic browser tools, so an external page can discover
            capabilities, create a project, generate assets, translate the deck, and read the resulting project
            snapshot.
          </p>
          <ul>
            <li>Tool discovery from the editor iframe</li>
            <li>Prompt, image, translate, and snapshot actions</li>
            <li>Same local-first editor surface behind every call</li>
          </ul>
          <a className="inline-section-link" href="/webmcp/">
            Open WebMCP demo
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </Reveal>
        <Reveal as="div" className="webmcp-media" delay={100} reveal="webmcp-media">
          <img
            src="/webmcp-showcase.png"
            alt="WebMCP showcase page discovering tools and controlling the LocalStudio editor"
            loading="lazy"
            decoding="async"
          />
          <span className="webmcp-cursor-path" aria-hidden="true" />
        </Reveal>
      </div>
    </section>
  );
}
