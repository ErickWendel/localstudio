import { ArrowRight } from 'lucide-react';
import { GitHubStarButton } from './GitHubStarButton';

const navItems = [
  { href: '#top', label: 'About it', sectionId: 'top' },
  { href: '#features', label: 'Features', sectionId: 'features' },
  { href: '#webmcp', label: 'WebMCP Showcase', sectionId: 'webmcp' },
  { href: '#requirements', label: 'Requirements', sectionId: 'requirements' },
] as const;

export function LandingHeader({
  activeSectionId,
  prefersReducedMotion,
}: {
  activeSectionId: string;
  prefersReducedMotion: boolean;
}) {
  return (
    <header className="landing-header">
      <a className="brand-mark" href="#top" aria-label="LocalStudio.dev beta home">
        LocalStudio.dev
        <span className="beta-flag">Beta</span>
      </a>
      <nav className="landing-nav" aria-label="Landing sections">
        {navItems.map((item) => {
          const isActive = activeSectionId === item.sectionId;

          return (
            <a
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'active' : undefined}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          );
        })}
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
