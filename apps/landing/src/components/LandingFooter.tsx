import { ArrowRight, ExternalLink, Star } from 'lucide-react';
import { externalLinks } from '../content/externalLinks';
import { socialLinks } from '../content/socialLinks';

function FooterStarCta() {
  return (
    <a className="footer-star-cta" href={externalLinks.githubRepo} target="_blank" rel="noreferrer">
      <Star size={18} aria-hidden="true" />
      Star the repo
      <ArrowRight size={16} aria-hidden="true" />
    </a>
  );
}

export function LandingFooter() {
  return (
    <footer className="landing-footer" aria-label="LocalStudio footer">
      <div>
        <a className="brand-mark footer-brand" href="#top" aria-label="LocalStudio.dev beta home">
          LocalStudio.dev
          <span className="beta-flag">Beta</span>
        </a>
        <p>Built by Erick Wendel for browser-native AI workflows.</p>
      </div>
      <nav className="footer-socials" aria-label="Erick Wendel social links">
        {socialLinks.map(({ label, href }) => (
          <a key={label} href={href} target="_blank" rel="noreferrer">
            {label}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ))}
      </nav>
      <FooterStarCta />
    </footer>
  );
}
