import type { AnimationDirection, AnimationEffect } from '../../../domain/documents/model';

type CanonicalAnimationEffect = Exclude<AnimationEffect, 'fade'>;

interface AnimationBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface AnimationPresetTransform {
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  x: number;
  y: number;
}

export interface AnimationPresetMask {
  fill: string;
  height: number;
  opacity: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
}

export interface AnimationPresetParticle {
  fill: string;
  height: number;
  opacity: number;
  radius: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
}

export interface AnimationPresetRenderState {
  canonicalEffect: CanonicalAnimationEffect;
  masks: AnimationPresetMask[];
  opacity: number;
  particles: AnimationPresetParticle[];
  transform: AnimationPresetTransform;
}

interface AnimationPresetOptions {
  bounds: AnimationBounds;
  direction?: AnimationDirection | undefined;
  effect: AnimationEffect;
  progress: number;
  seed: string;
}

const defaultTransform: AnimationPresetTransform = {
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  x: 0,
  y: 0,
};

const particleColors = ['#37FD76', '#0EA5E9', '#F97316', '#FACC15', '#EC4899', '#FFFFFF'];

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  const progress = clamp(value);
  return 1 - Math.pow(1 - progress, 3);
}

function canonicalizeEffect(effect: AnimationEffect): CanonicalAnimationEffect {
  return effect === 'fade' ? 'fade-and-move' : effect;
}

function getDirectionVector(direction: AnimationDirection | undefined) {
  if (direction === 'right') return { x: 1, y: 0 };
  if (direction === 'up') return { x: 0, y: -1 };
  if (direction === 'down') return { x: 0, y: 1 };
  return { x: -1, y: 0 };
}

function getTravel(bounds: AnimationBounds) {
  return Math.max(48, Math.min(280, Math.max(bounds.width, bounds.height) * 0.6));
}

function createTransform(patch: Partial<AnimationPresetTransform>): AnimationPresetTransform {
  return { ...defaultTransform, ...patch };
}

function createMask(
  bounds: AnimationBounds,
  patch: Partial<AnimationPresetMask>,
): AnimationPresetMask {
  return {
    fill: '#ffffff',
    height: bounds.height,
    opacity: 1,
    rotation: 0,
    width: bounds.width,
    x: 0,
    y: 0,
    ...patch,
  };
}

function createSideMask(
  bounds: AnimationBounds,
  direction: AnimationDirection | undefined,
  progress: number,
) {
  const remaining = 1 - easeOutCubic(progress);
  if (direction === 'up') {
    return [createMask(bounds, { height: bounds.height * remaining, y: 0 })];
  }
  if (direction === 'down') {
    const height = bounds.height * remaining;
    return [createMask(bounds, { height, y: bounds.height - height })];
  }
  if (direction === 'right') {
    const width = bounds.width * remaining;
    return [createMask(bounds, { width, x: bounds.width - width })];
  }
  return [createMask(bounds, { width: bounds.width * remaining, x: 0 })];
}

function createCenterMasks(bounds: AnimationBounds, progress: number) {
  const eased = easeOutCubic(progress);
  const revealWidth = bounds.width * eased;
  const revealHeight = bounds.height * eased;
  const left = (bounds.width - revealWidth) / 2;
  const top = (bounds.height - revealHeight) / 2;
  return [
    createMask(bounds, { height: top, y: 0 }),
    createMask(bounds, { height: top, y: bounds.height - top }),
    createMask(bounds, { height: revealHeight, width: left, x: 0, y: top }),
    createMask(bounds, { height: revealHeight, width: left, x: bounds.width - left, y: top }),
  ].filter((mask) => mask.height > 0.5 && mask.width > 0.5);
}

function createTileMasks(bounds: AnimationBounds, progress: number, columns: number, rows: number) {
  const masks: AnimationPresetMask[] = [];
  const tileWidth = bounds.width / columns;
  const tileHeight = bounds.height / rows;
  const eased = easeOutCubic(progress);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const tileOrder = (row + column) / Math.max(1, rows + columns - 2);
      const localProgress = clamp((eased - tileOrder * 0.15) / 0.85);
      const shrink = 1 - localProgress;
      if (shrink <= 0.02) continue;
      masks.push(
        createMask(bounds, {
          height: tileHeight * shrink,
          opacity: 0.95,
          width: tileWidth * shrink,
          x: column * tileWidth + (tileWidth * (1 - shrink)) / 2,
          y: row * tileHeight + (tileHeight * (1 - shrink)) / 2,
        }),
      );
    }
  }
  return masks;
}

function createBlindsMasks(bounds: AnimationBounds, progress: number) {
  const masks: AnimationPresetMask[] = [];
  const count = 8;
  const stripeHeight = bounds.height / count;
  const remaining = 1 - easeOutCubic(progress);
  for (let index = 0; index < count; index += 1) {
    masks.push(
      createMask(bounds, {
        height: stripeHeight * remaining,
        width: bounds.width,
        y: index * stripeHeight,
      }),
    );
  }
  return masks;
}

function createColorPlaneMasks(bounds: AnimationBounds, progress: number) {
  const colors = ['#37FD76', '#0EA5E9', '#F97316', '#111827'];
  const masks: AnimationPresetMask[] = [];
  for (let index = 0; index < colors.length; index += 1) {
    const delayedProgress = clamp((progress - index * 0.08) / 0.76);
    const width = bounds.width * (1 - easeOutCubic(delayedProgress));
    if (width <= 0.5) continue;
    masks.push(
      createMask(bounds, {
        fill: colors[index] ?? '#ffffff',
        opacity: 0.9,
        width,
        x: bounds.width - width,
      }),
    );
  }
  return masks;
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function createParticles(bounds: AnimationBounds, progress: number, seed: string, mode: 'confetti' | 'swoosh') {
  const random = seededRandom(seed);
  const count = mode === 'confetti' ? 22 : 10;
  const eased = easeOutCubic(progress);
  const particles: AnimationPresetParticle[] = [];
  for (let index = 0; index < count; index += 1) {
    const startX = random() * bounds.width;
    const drift = (random() - 0.5) * bounds.width * (mode === 'confetti' ? 0.5 : 0.25);
    const lift = bounds.height * (0.2 + random() * 0.8);
    const size = mode === 'confetti' ? 4 + random() * 7 : 3 + random() * 3;
    particles.push({
      fill: particleColors[index % particleColors.length] ?? '#37FD76',
      height: mode === 'confetti' ? size * 0.7 : size,
      opacity: Math.max(0, 1 - progress * 0.85),
      radius: mode === 'confetti' ? 0 : size,
      rotation: random() * 360 + progress * 240,
      width: mode === 'confetti' ? size : bounds.width * (0.12 + random() * 0.14),
      x: startX + drift * eased,
      y: bounds.height * 0.72 - lift * eased + random() * bounds.height * 0.16,
    });
  }
  return particles;
}

function getRenderState({
  bounds,
  direction,
  effect,
  progress,
  seed,
}: AnimationPresetOptions): AnimationPresetRenderState {
  const canonicalEffect = canonicalizeEffect(effect);
  const eased = easeOutCubic(progress);
  const vector = getDirectionVector(direction);
  const travel = getTravel(bounds);
  let opacity = 1;
  let transform = defaultTransform;
  let masks: AnimationPresetMask[] = [];
  let particles: AnimationPresetParticle[] = [];

  if (canonicalEffect === 'dissolve') {
    opacity = eased;
  }

  if (canonicalEffect === 'fade-and-move') {
    opacity = eased;
    transform = createTransform({
      x: vector.x * travel * (1 - eased),
      y: vector.y * travel * (1 - eased),
    });
  }

  if (canonicalEffect === 'move-in' || canonicalEffect === 'push') {
    transform = createTransform({
      x: vector.x * travel * (1 - eased),
      y: vector.y * travel * (1 - eased),
    });
  }

  if (canonicalEffect === 'drop') {
    opacity = eased;
    transform = createTransform({ y: -travel * 0.85 * (1 - eased), scaleY: 0.9 + eased * 0.1 });
  }

  if (canonicalEffect === 'fall') {
    opacity = eased;
    transform = createTransform({
      offsetX: bounds.width / 2,
      offsetY: bounds.height,
      rotation: -18 * (1 - eased),
      x: bounds.width / 2,
      y: bounds.height - travel * 0.35 * (1 - eased),
    });
  }

  if (canonicalEffect === 'scale') {
    opacity = eased;
    transform = createTransform({
      offsetX: bounds.width / 2,
      offsetY: bounds.height / 2,
      scaleX: 0.55 + eased * 0.45,
      scaleY: 0.55 + eased * 0.45,
      x: bounds.width / 2,
      y: bounds.height / 2,
    });
  }

  if (canonicalEffect === 'switch' || canonicalEffect === 'swap') {
    opacity = eased;
    transform = createTransform({
      offsetX: bounds.width / 2,
      offsetY: bounds.height / 2,
      rotation: (canonicalEffect === 'switch' ? -8 : 8) * (1 - eased),
      scaleX: 0.82 + eased * 0.18,
      scaleY: 0.82 + eased * 0.18,
      x: bounds.width / 2 + vector.x * travel * 0.32 * (1 - eased),
      y: bounds.height / 2 + vector.y * travel * 0.32 * (1 - eased),
    });
  }

  if (
    canonicalEffect === 'flip' ||
    canonicalEffect === 'flop' ||
    canonicalEffect === 'cube' ||
    canonicalEffect === 'doorway' ||
    canonicalEffect === 'page-flip' ||
    canonicalEffect === 'revolving-door'
  ) {
    opacity = 0.25 + eased * 0.75;
    transform = createTransform({
      offsetX: bounds.width / 2,
      offsetY: bounds.height / 2,
      scaleX:
        canonicalEffect === 'flop'
          ? 0.25 + eased * 0.75
          : canonicalEffect === 'doorway' || canonicalEffect === 'revolving-door'
            ? 0.18 + eased * 0.82
            : 1,
      scaleY: canonicalEffect === 'flip' ? 0.25 + eased * 0.75 : 1,
      skewX: canonicalEffect === 'cube' || canonicalEffect === 'page-flip' ? 18 * (1 - eased) : 0,
      x: bounds.width / 2,
      y: bounds.height / 2,
    });
  }

  if (
    canonicalEffect === 'twirl' ||
    canonicalEffect === 'twist' ||
    canonicalEffect === 'pivot' ||
    canonicalEffect === 'reflection' ||
    canonicalEffect === 'clothesline'
  ) {
    opacity = eased;
    transform = createTransform({
      offsetX: canonicalEffect === 'pivot' ? 0 : bounds.width / 2,
      offsetY: canonicalEffect === 'clothesline' ? 0 : bounds.height / 2,
      rotation:
        canonicalEffect === 'twirl'
          ? -180 * (1 - eased)
          : canonicalEffect === 'twist'
            ? -70 * (1 - eased)
            : canonicalEffect === 'clothesline'
              ? -40 * (1 - eased)
              : -22 * (1 - eased),
      scaleX: canonicalEffect === 'reflection' ? 0.7 + eased * 0.3 : 1,
      scaleY: canonicalEffect === 'twist' ? 0.55 + eased * 0.45 : 1,
      x: canonicalEffect === 'pivot' ? 0 : bounds.width / 2,
      y: canonicalEffect === 'clothesline' ? 0 : bounds.height / 2,
    });
  }

  if (canonicalEffect === 'wipe' || canonicalEffect === 'reveal') {
    masks = createSideMask(bounds, direction, progress);
  }

  if (canonicalEffect === 'iris' || canonicalEffect === 'radial-wipe' || canonicalEffect === 'droplet') {
    masks = createCenterMasks(bounds, progress);
  }

  if (canonicalEffect === 'grid') {
    masks = createTileMasks(bounds, progress, 4, 3);
  }

  if (canonicalEffect === 'mosaic') {
    masks = createTileMasks(bounds, progress, 6, 4);
  }

  if (canonicalEffect === 'blinds') {
    masks = createBlindsMasks(bounds, progress);
  }

  if (canonicalEffect === 'color-planes' || canonicalEffect === 'fade-through-color') {
    opacity = canonicalEffect === 'fade-through-color' ? eased : opacity;
    masks = createColorPlaneMasks(bounds, progress);
  }

  if (canonicalEffect === 'confetti' || canonicalEffect === 'swoosh') {
    opacity = eased;
    particles = createParticles(bounds, progress, seed, canonicalEffect);
  }

  if (canonicalEffect === 'keyboard-typing' || canonicalEffect === 'line-draw') {
    opacity = 1;
  }

  return {
    canonicalEffect,
    masks,
    opacity,
    particles,
    transform: createTransform(transform),
  };
}

export const animationPresetEngine = {
  getRenderState,
};
