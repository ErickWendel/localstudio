import { describe, expect, it } from 'vitest';
import { colorInputValue } from '../../../../src/ui/editor/panels/design-controls/colorInputValue';

describe('colorInputValue', () => {
  it('normalizes supported hex colors for native color inputs', () => {
    expect(colorInputValue('#ABCDEF')).toBe('#abcdef');
    expect(colorInputValue('#0f0')).toBe('#00ff00');
  });

  it('provides a valid fallback for colors native inputs cannot represent', () => {
    expect(colorInputValue('rgba(255, 255, 255, 0.5)')).toBe('#000000');
    expect(colorInputValue(undefined)).toBe('#000000');
  });
});
