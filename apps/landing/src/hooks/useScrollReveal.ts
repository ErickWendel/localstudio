import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export function useScrollReveal() {
  const elementRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const element = elementRef.current;

    if (!element || !('IntersectionObserver' in window)) {
      const frameId = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frameId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.18 },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return { elementRef, isVisible: prefersReducedMotion || isVisible };
}
