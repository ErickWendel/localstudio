import type { AnimationEffect } from '../../../domain/documents/model';

interface AnimationEffectOption {
  label: string;
  value: AnimationEffect;
}

interface AnimationEffectGroup {
  label: string;
  options: AnimationEffectOption[];
}

const heavyEffects = new Set<AnimationEffect>([
  'blinds',
  'clothesline',
  'color-planes',
  'confetti',
  'cube',
  'doorway',
  'droplet',
  'fade-through-color',
  'fall',
  'flip',
  'flop',
  'grid',
  'iris',
  'mosaic',
  'page-flip',
  'pivot',
  'radial-wipe',
  'reflection',
  'revolving-door',
  'swoosh',
  'twirl',
  'twist',
]);

const groupedOptions: AnimationEffectGroup[] = [
  {
    label: 'Appear & Move',
    options: [
      { label: 'Clothesline', value: 'clothesline' },
      { label: 'Confetti', value: 'confetti' },
      { label: 'Dissolve', value: 'dissolve' },
      { label: 'Drop', value: 'drop' },
      { label: 'Droplet', value: 'droplet' },
      { label: 'Fade and Move', value: 'fade-and-move' },
      { label: 'Fade Through Color', value: 'fade-through-color' },
      { label: 'Grid', value: 'grid' },
      { label: 'Iris', value: 'iris' },
      { label: 'Move In', value: 'move-in' },
      { label: 'Push', value: 'push' },
      { label: 'Radial Wipe', value: 'radial-wipe' },
      { label: 'Reveal', value: 'reveal' },
      { label: 'Switch', value: 'switch' },
      { label: 'Wipe', value: 'wipe' },
    ],
  },
  {
    label: 'Flip, Spin & Scale',
    options: [
      { label: 'Blinds', value: 'blinds' },
      { label: 'Color Planes', value: 'color-planes' },
      { label: 'Cube', value: 'cube' },
      { label: 'Doorway', value: 'doorway' },
      { label: 'Fall', value: 'fall' },
      { label: 'Flip', value: 'flip' },
      { label: 'Flop', value: 'flop' },
      { label: 'Mosaic', value: 'mosaic' },
      { label: 'Page Flip', value: 'page-flip' },
      { label: 'Pivot', value: 'pivot' },
      { label: 'Reflection', value: 'reflection' },
      { label: 'Revolving Door', value: 'revolving-door' },
      { label: 'Scale', value: 'scale' },
      { label: 'Swap', value: 'swap' },
      { label: 'Swoosh', value: 'swoosh' },
      { label: 'Twirl', value: 'twirl' },
      { label: 'Twist', value: 'twist' },
    ],
  },
];

const values = new Set(groupedOptions.flatMap((group) => group.options.map((option) => option.value)));

function hasEffect(value: string): value is AnimationEffect {
  return values.has(value as AnimationEffect);
}

function getDefaultDurationMs(effect: AnimationEffect) {
  return heavyEffects.has(effect) ? 700 : 500;
}

export const animationEffectCatalog = {
  getDefaultDurationMs,
  groupedOptions,
  hasEffect,
};
