import { useEffect, useState } from 'react';

const landingSectionIds = ['top', 'features', 'webmcp', 'requirements'];
const sectionObserverThresholds = [0, 0.18, 0.34, 0.5, 0.66, 0.82, 1];

export function useActiveSection() {
  const [activeSectionId, setActiveSectionId] = useState('top');

  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      return;
    }

    const visibleSectionRatios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleSectionRatios.set(
            entry.target.id,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        }

        const nextSectionId = landingSectionIds.reduce(
          (currentSectionId, sectionId) =>
            (visibleSectionRatios.get(sectionId) ?? 0) >
            (visibleSectionRatios.get(currentSectionId) ?? 0)
              ? sectionId
              : currentSectionId,
          'top',
        );

        setActiveSectionId(nextSectionId);
      },
      { rootMargin: '-18% 0px -48% 0px', threshold: sectionObserverThresholds },
    );

    for (const sectionId of landingSectionIds) {
      const section = document.getElementById(sectionId);
      if (section) {
        observer.observe(section);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return activeSectionId;
}
