import { useEffect, useState } from 'react';
import { externalLinks } from '../content/externalLinks';

const githubStarCount = 9999;

function useAnimatedStarCount(target: number, prefersReducedMotion: boolean) {
  const [count, setCount] = useState(target);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const startCount = Math.max(0, target - 999);
    const durationMs = 2800;
    const holdMs = 1400;
    const cycleMs = durationMs + holdMs;
    let animationFrame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - start) % cycleMs;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startCount + (target - startCount) * easedProgress));

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrame);
  }, [prefersReducedMotion, target]);

  return prefersReducedMotion ? target : count;
}

function GitHubLogo() {
  return (
    <svg className="github-logo" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.7 5.47 7.78.4.07.55-.18.55-.39 0-.2-.01-.84-.01-1.53-2.01.38-2.53-.5-2.69-.96-.09-.24-.48-.96-.82-1.15-.28-.16-.68-.55-.01-.56.63-.01 1.08.59 1.23.84.72 1.24 1.87.89 2.33.68.07-.53.28-.89.51-1.1-1.78-.21-3.64-.91-3.64-4.04 0-.89.31-1.62.82-2.19-.08-.21-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.4 7.4 0 0 1 8 3.99c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.95.08 2.16.51.57.82 1.3.82 2.19 0 3.14-1.87 3.83-3.65 4.04.29.26.54.75.54 1.52 0 1.1-.01 1.98-.01 2.25 0 .21.15.47.55.39A8.13 8.13 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z"
      />
    </svg>
  );
}

export function GitHubStarButton({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  const stars = useAnimatedStarCount(githubStarCount, prefersReducedMotion);

  return (
    <a
      className="github-star-button"
      href={externalLinks.githubRepo}
      target="_blank"
      rel="noreferrer"
      aria-label="Star LocalStudio.dev on GitHub"
    >
      <GitHubLogo />
      <span className="github-star-divider" aria-hidden="true" />
      <span className="github-star-count" aria-label={`${githubStarCount} GitHub stars`}>
        {stars}
      </span>
    </a>
  );
}
