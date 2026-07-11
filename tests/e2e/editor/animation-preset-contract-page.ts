import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { animationPresetContractFixtures } from './animation-preset-contract-fixtures';

type AnimationPresetContractResult = {
  animationCanonicalEffects: string[];
  animationMaskTotal: number;
  animationParticleTotal: number;
  sideMaskCounts: number[];
};

export const animationPresetContractPage = {
  async run(page: Page, baseURL: string): Promise<AnimationPresetContractResult> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(
      async ({ bounds, directions, effects }) => {
        const { animationPresetEngine } = (await import(
          '/editor/src/ui/editor/animation/animationPresetEngine.ts'
        )) as typeof import('../../../apps/editor/src/ui/editor/animation/animationPresetEngine');

        const animationStates = effects.map((effect, index) =>
          animationPresetEngine.getRenderState({
            bounds,
            direction: directions[index % directions.length],
            effect,
            progress: index % 3 === 0 ? 0 : index % 3 === 1 ? 0.45 : 1,
            seed: `seed-${effect}`,
          }),
        );
        const sideMaskCounts = directions.map(
          (direction) =>
            animationPresetEngine.getRenderState({
              bounds,
              direction,
              effect: 'wipe',
              progress: 0.5,
              seed: `wipe-${direction}`,
            }).masks.length,
        );

        return {
          animationCanonicalEffects: animationStates.map((state) => state.canonicalEffect),
          animationMaskTotal: animationStates.reduce((sum, state) => sum + state.masks.length, 0),
          animationParticleTotal: animationStates.reduce(
            (sum, state) => sum + state.particles.length,
            0,
          ),
          sideMaskCounts,
        };
      },
      {
        bounds: animationPresetContractFixtures.createBounds(),
        directions: animationPresetContractFixtures.createDirections(),
        effects: animationPresetContractFixtures.createEffects(),
      },
    );
  },
};
