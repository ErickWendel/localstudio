import type { animationPresetContractFixtures } from './animation-preset-contract-fixtures';

export type AnimationPresetContractInput = {
  bounds: ReturnType<typeof animationPresetContractFixtures.createBounds>;
  directions: ReturnType<typeof animationPresetContractFixtures.createDirections>;
  effects: ReturnType<typeof animationPresetContractFixtures.createEffects>;
};

export type AnimationPresetContractResult = {
  animationCanonicalEffects: string[];
  animationMaskTotal: number;
  animationParticleTotal: number;
  sideMaskCounts: number[];
};

export async function evaluateAnimationPresetContract({
  bounds,
  directions,
  effects,
}: AnimationPresetContractInput): Promise<AnimationPresetContractResult> {
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
}
