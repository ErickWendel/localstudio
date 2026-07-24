import { localStudioAppRoutes } from '@localstudio/app-routes';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { BrandLockup } from './BrandLockup';
import { GitHubStarButton } from './GitHubStarButton';

const navItems = [
  { href: '#top', label: 'About it', sectionId: 'top' },
  { href: '#features', label: 'Features', sectionId: 'features' },
  { href: '#requirements', label: 'Requirements', sectionId: 'requirements' },
  { href: localStudioAppRoutes.docs.gettingStartedAnchor, label: 'Docs', sectionId: 'docs' },
  { href: '#pricing', label: 'Pricing', sectionId: 'pricing' },
] as const;

export function LandingHeader({
  activeSectionId,
  prefersReducedMotion,
}: {
  activeSectionId: string;
  prefersReducedMotion: boolean;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="landing-header">
      <a className="brand-mark" href="#top" aria-label="LocalStudio.dev beta home">
        <BrandLockup />
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
        <a className="header-cta desktop-header-cta" href="/editor/">
          Open editor
          <ArrowRight size={16} aria-hidden="true" />
        </a>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-landing-nav"
          aria-label={isMobileMenuOpen ? 'Close section menu' : 'Open section menu'}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
        >
          {isMobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>
      <nav
        id="mobile-landing-nav"
        className={isMobileMenuOpen ? 'mobile-landing-nav open' : 'mobile-landing-nav'}
        aria-label="Mobile landing sections"
        hidden={!isMobileMenuOpen}
      >
        {navItems.map((item) => {
          const isActive = activeSectionId === item.sectionId;

          return (
            <a
              aria-current={isActive ? 'page' : undefined}
              className={isActive ? 'active' : undefined}
              href={item.href}
              key={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
