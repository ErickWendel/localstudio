import { LandingFooter } from './components/LandingFooter';
import { LandingHeader } from './components/LandingHeader';
import { MotionBackdrop } from './components/MotionBackdrop';
import { useActiveSection } from './hooks/useActiveSection';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { ClosingSection } from './sections/ClosingSection';
import { DemoSection } from './sections/DemoSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { HeroSection } from './sections/HeroSection';
import { RequirementsSection } from './sections/RequirementsSection';
import { ShowcaseSection } from './sections/ShowcaseSection';
import { ThanksSection } from './sections/ThanksSection';
import { WebAiSection } from './sections/WebAiSection';
import { WebMcpSection } from './sections/WebMcpSection';

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
      <WebMcpSection />
      <FeaturesSection prefersReducedMotion={prefersReducedMotion} />
      <RequirementsSection />
      <ThanksSection />
      <ClosingSection />
      <LandingFooter />
    </main>
  );
}
