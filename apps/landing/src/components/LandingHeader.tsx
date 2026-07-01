import { ArrowRight } from 'lucide-react';
import { GitHubStarButton } from './GitHubStarButton';

export function LandingHeader({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <header className="landing-header">
      <a className="brand-mark" href="#top" aria-label="LocalStudio.dev beta home">
        LocalStudio.dev
        <span className="beta-flag">Beta</span>
      </a>
      <nav className="landing-nav" aria-label="Landing sections">
        <a href="#top">Workflow</a>
        <a href="#showcase">Showcase</a>
        <a href="#web-ai">Web AI</a>
        <a href="#webmcp">WebMCP</a>
        <a href="#features">Editor</a>
        <a href="#requirements">Requirements</a>
        <a href="#thanks">Thanks</a>
      </nav>
      <div className="header-actions">
        <GitHubStarButton prefersReducedMotion={prefersReducedMotion} />
        <a className="header-cta" href="/editor/">
          Open editor
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
