export const animationPresetContractFixtures = {
  createBounds() {
    return { height: 180, width: 320, x: 10, y: 20 };
  },

  createDirections() {
    return ['left', 'right', 'up', 'down'] as const;
  },

  createEffects() {
    return [
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
  },
};
