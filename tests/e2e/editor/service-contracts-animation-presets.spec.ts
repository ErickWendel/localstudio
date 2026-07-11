import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes animation preset contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async () => {
    const { animationPresetEngine } = (await import(
      '/editor/src/ui/editor/animation/animationPresetEngine.ts'
    )) as typeof import('../../../apps/editor/src/ui/editor/animation/animationPresetEngine');

    const bounds = { height: 180, width: 320, x: 10, y: 20 };
    const effects = [
      'fade',
      'fade-and-move',
      'move-in',
      'push',
      'drop',
      'fall',
      'scale',
      'switch',
      'swap',
      'flip',
      'flop',
      'cube',
      'doorway',
      'page-flip',
      'revolving-door',
      'twirl',
      'twist',
      'pivot',
      'reflection',
      'clothesline',
      'wipe',
      'reveal',
      'iris',
      'radial-wipe',
      'droplet',
      'grid',
      'mosaic',
      'blinds',
      'color-planes',
      'fade-through-color',
      'confetti',
      'swoosh',
      'keyboard-typing',
      'line-draw',
      'dissolve',
    ] as const;
    const directions = ['left', 'right', 'up', 'down'] as const;
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
  });

  expect(result.animationCanonicalEffects).toContain('fade-and-move');
  expect(result.animationMaskTotal).toBeGreaterThan(10);
  expect(result.animationParticleTotal).toBeGreaterThan(20);
  expect(result.sideMaskCounts).toEqual([1, 1, 1, 1]);
});
