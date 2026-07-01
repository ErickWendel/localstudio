import { ExternalLink } from 'lucide-react';
import { externalLinks } from '../content/externalLinks';

export function ThanksSection() {
  return (
    <section id="thanks" className="thanks-section" aria-labelledby="thanks-title">
      <div className="section-heading">
        <p className="eyebrow">Thank you</p>
        <h2 id="thanks-title">Built on the work of the browser AI community.</h2>
        <p>
          Thanks to the Chrome Web Team for pushing built-in AI APIs forward, and to the Hugging Face WebML community
          for making local browser models easier to discover and run.
        </p>
      </div>
      <div className="thanks-links" aria-label="Browser AI resources">
        <a href={externalLinks.chromeBuiltInAi} target="_blank" rel="noreferrer">
          Chrome Built-in AI
          <ExternalLink size={16} aria-hidden="true" />
        </a>
        <a href={externalLinks.huggingFaceWebMl} target="_blank" rel="noreferrer">
          Hugging Face WebML community
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
