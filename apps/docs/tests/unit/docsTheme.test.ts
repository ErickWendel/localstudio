import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const themePath = resolve(import.meta.dirname, '../../.vitepress/theme/custom.css');

describe('docs theme', () => {
  it('defines LocalStudio light and dark mode tokens', () => {
    const css = readFileSync(themePath, 'utf8');

    expect(css).toContain(':root');
    expect(css).toContain('.dark');
    expect(css).toContain('--vp-c-brand-1');
    expect(css).toContain('--ls-font-display');
  });
});
