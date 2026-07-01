import { useEffect, useState } from 'react';

const landingSectionIds = ['top', 'features', 'webmcp', 'requirements'];

export function useActiveSection() {
  const [activeSectionId, setActiveSectionId] = useState('top');

  useEffect(() => {
    let frameId = 0;

    const updateActiveSection = () => {
      const anchorLine = window.innerHeight * 0.34;
      const sectionId =
        landingSectionIds
          .map((id) => {
            const section = document.getElementById(id);
            const distance = section ? Math.abs(section.getBoundingClientRect().top - anchorLine) : Number.POSITIVE_INFINITY;

            return { distance, id };
          })
          .sort((firstSection, secondSection) => firstSection.distance - secondSection.distance)[0]?.id ?? 'top';

      setActiveSectionId(sectionId);
    };

    const requestActiveSectionUpdate = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener('scroll', requestActiveSectionUpdate, { passive: true });
    window.addEventListener('resize', requestActiveSectionUpdate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', requestActiveSectionUpdate);
      window.removeEventListener('resize', requestActiveSectionUpdate);
    };
  }, []);

  return activeSectionId;
}
