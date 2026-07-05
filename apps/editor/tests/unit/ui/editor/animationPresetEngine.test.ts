import { describe, expect, it } from 'vitest';
import type { AnimationEffect } from '../../../../src/domain/documents/model';
import { animationPresetEngine } from '../../../../src/ui/editor/animation/animationPresetEngine';

describe('animationPresetEngine', () => {
  const bounds = { height: 120, width: 240, x: 40, y: 80 };

  it('supports the full object animation catalog', () => {
    const effects: AnimationEffect[] = [
      'clothesline',
      'confetti',
      'dissolve',
      'drop',
      'droplet',
      'fade-and-move',
      'fade-through-color',
      'grid',
      'iris',
      'move-in',
      'push',
      'radial-wipe',
      'reveal',
      'switch',
      'wipe',
      'blinds',
      'color-planes',
      'cube',
      'doorway',
      'fall',
      'flip',
      'flop',
      'mosaic',
      'page-flip',
      'pivot',
      'reflection',
      'revolving-door',
      'scale',
      'swap',
      'swoosh',
      'twirl',
      'twist',
      'fade',
      'keyboard-typing',
      'line-draw',
    ];

    for (const effect of effects) {
      expect(
        animationPresetEngine.getRenderState({
          bounds,
          direction: 'right',
          effect,
          progress: 0.5,
          seed: `build-${effect}`,
        }).canonicalEffect,
      ).toBe(effect === 'fade' ? 'fade-and-move' : effect);
    }
  });

  it('returns finite transform values at progress boundaries', () => {
    const effects: AnimationEffect[] = ['move-in', 'scale', 'cube', 'twist', 'clothesline'];

    for (const effect of effects) {
      for (const progress of [0, 0.5, 1]) {
        const state = animationPresetEngine.getRenderState({
          bounds,
          direction: 'left',
          effect,
          progress,
          seed: `finite-${effect}`,
        });

        expect(Number.isFinite(state.transform.x)).toBe(true);
        expect(Number.isFinite(state.transform.y)).toBe(true);
        expect(Number.isFinite(state.transform.scaleX)).toBe(true);
        expect(Number.isFinite(state.transform.scaleY)).toBe(true);
        expect(Number.isFinite(state.transform.rotation)).toBe(true);
        expect(Number.isFinite(state.opacity)).toBe(true);
      }
    }
  });

  it('moves directional effects from the requested side', () => {
    const fromLeft = animationPresetEngine.getRenderState({
      bounds,
      direction: 'left',
      effect: 'move-in',
      progress: 0,
      seed: 'direction-left',
    });
    const fromRight = animationPresetEngine.getRenderState({
      bounds,
      direction: 'right',
      effect: 'move-in',
      progress: 0,
      seed: 'direction-right',
    });

    expect(fromLeft.transform.x).toBeLessThan(0);
    expect(fromRight.transform.x).toBeGreaterThan(0);
  });

  it('creates deterministic particles for accent effects', () => {
    const first = animationPresetEngine.getRenderState({
      bounds,
      effect: 'confetti',
      progress: 0.35,
      seed: 'build-a-element-a',
    });
    const second = animationPresetEngine.getRenderState({
      bounds,
      effect: 'confetti',
      progress: 0.35,
      seed: 'build-a-element-a',
    });
    const different = animationPresetEngine.getRenderState({
      bounds,
      effect: 'confetti',
      progress: 0.35,
      seed: 'build-b-element-a',
    });

    expect(first.particles).toEqual(second.particles);
    expect(first.particles).not.toEqual(different.particles);
    expect(first.particles.length).toBeGreaterThan(0);
  });

  it('produces mask overlays for tile and wipe effects', () => {
    const wipe = animationPresetEngine.getRenderState({
      bounds,
      direction: 'right',
      effect: 'wipe',
      progress: 0.5,
      seed: 'wipe',
    });
    const grid = animationPresetEngine.getRenderState({
      bounds,
      effect: 'grid',
      progress: 0.5,
      seed: 'grid',
    });

    expect(wipe.masks.length).toBeGreaterThan(0);
    expect(grid.masks.length).toBeGreaterThan(4);
  });
});
