import { LandingFooter } from './components/LandingFooter';
import { LandingHeader } from './components/LandingHeader';
import { MotionBackdrop } from './components/MotionBackdrop';
import { useActiveSection } from './hooks/useActiveSection';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { ClosingSection } from './sections/ClosingSection';
import { DemoSection } from './sections/DemoSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { HeroSection } from './sections/HeroSection';
import { PricingSection } from './sections/PricingSection';
import { RequirementsSection } from './sections/RequirementsSection';
import { ShowcaseSection } from './sections/ShowcaseSection';
import { ThanksSection } from './sections/ThanksSection';
import { WebAiSection } from './sections/WebAiSection';

export function LandingPage() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const activeSectionId = useActiveSection();

  return (
    <main className="landing-shell">
      <MotionBackdrop />
      <LandingHeader activeSectionId={activeSectionId} prefersReducedMotion={prefersReducedMotion} />
      <HeroSection prefersReducedMotion={prefersReducedMotion} />
      <ShowcaseSection />
      <DemoSection />
      <WebAiSection />
      <FeaturesSection />
      <PricingSection />
      <RequirementsSection />
      <ThanksSection />
      <ClosingSection />
      <LandingFooter />
    </main>
  );
}
