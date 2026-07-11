import type { Page as SlidePage } from '../../../apps/editor/src/domain/documents/model';

export const presenterRouteSlide = {
  create({
    background,
    elementIds,
    id,
    name,
    speakerNotes,
  }: Pick<SlidePage, 'background' | 'elementIds' | 'id' | 'name' | 'speakerNotes'>): SlidePage {
    return {
      background,
      elementIds,
      height: 1080,
      id,
      name,
      speakerNotes,
      width: 1920,
      animationBuilds:
        id === 'slide-1'
          ? [
              {
                delayMs: 0,
                durationMs: 400,
                effect: 'fade',
                elementId: 'headline-1',
                id: 'build-headline',
                kind: 'build-in',
                trigger: 'on-click',
              },
            ]
          : undefined,
    };
  },
};
