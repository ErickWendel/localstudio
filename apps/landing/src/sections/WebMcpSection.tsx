import { ArrowRight } from 'lucide-react';
import { Reveal } from '../components/Reveal';

const webMcpImage = {
  src: '/webmcp-showcase.png',
  srcSet: '/webmcp-showcase-645.webp 645w',
  largeSrcSet: '/webmcp-showcase-1290.webp 1290w',
  alt: 'WebMCP showcase page discovering tools and controlling the LocalStudio editor',
  width: 4040,
  height: 2378,
} as const;

export function WebMcpSection() {
  return (
    <section id="webmcp" className="webmcp-section" aria-labelledby="webmcp-title">
      <div className="showcase-row">
        <Reveal as="div" className="showcase-copy" reveal="webmcp-copy">
          <p className="eyebrow">WebMCP showcase</p>
          <h2 id="webmcp-title">A host page can drive the editor through browser tools.</h2>
          <p>
            WebMCP exposes LocalStudio actions as semantic browser tools, so an external page can
            discover capabilities, create a project, generate assets, translate the deck, and read
            the resulting project snapshot.
          </p>
          <ul>
            <li>Tool discovery from the editor iframe</li>
            <li>Prompt, image, translate, and snapshot actions</li>
            <li>Same local-first editor surface behind every call</li>
          </ul>
          <a className="inline-section-link" href="/editor/webmcp">
            Open WebMCP demo
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        </Reveal>
        <Reveal as="div" className="webmcp-media" delay={100} reveal="webmcp-media">
          <picture>
            <source
              media="(min-width: 900px)"
              type="image/webp"
              srcSet={webMcpImage.largeSrcSet}
              sizes="645px"
            />
            <source
              type="image/webp"
              srcSet={webMcpImage.srcSet}
              sizes="(max-width: 760px) 92vw, 645px"
            />
            <img
              src={webMcpImage.src}
              alt={webMcpImage.alt}
              width={webMcpImage.width}
              height={webMcpImage.height}
              loading="lazy"
              decoding="async"
            />
          </picture>
          <span className="webmcp-cursor-path" aria-hidden="true" />
        </Reveal>
      </div>
    </section>
  );
}
