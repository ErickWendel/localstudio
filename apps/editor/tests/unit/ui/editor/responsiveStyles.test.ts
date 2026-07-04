import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesPath = resolve(__dirname, '../../../../src/app/styles.css');

function readComposedStyles(filePath: string, visited = new Set<string>()): string {
  if (visited.has(filePath)) return '';
  visited.add(filePath);

  const styles = readFileSync(filePath, 'utf8');
  return styles.replace(/@import\s+['"]([^'"]+)['"];\s*/g, (statement, importPath: string) => {
    if (!importPath.startsWith('.')) return statement;
    return readComposedStyles(resolve(dirname(filePath), importPath), visited);
  });
}

describe('editor responsive styles', () => {
  const styles = readComposedStyles(stylesPath);

  it('does not force the editor viewport to desktop width on mobile', () => {
    expect(styles).not.toMatch(/body\s*\{[^}]*min-width:\s*1024px/s);
  });

  it('defines a mobile editor shell breakpoint for phone layouts', () => {
    expect(styles).toMatch(/\.top-toolbar\s*\{[\s\S]*position:\s*relative/s);
    expect(styles).toMatch(/\.top-toolbar\s*\{[\s\S]*z-index:\s*220/s);
    expect(styles).toMatch(/\.toolbar-left\s*\{[\s\S]*overflow:\s*visible/s);
    expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.editor-grid/s);
    expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.left-tool-panel/s);
    expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*\.pages-panel/s);
  });

  it('keeps the mobile prompt composer compact', () => {
    expect(styles).toMatch(
      /\.prompt-bar\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/s,
    );
    expect(styles).toMatch(/\.prompt-input-cluster\s*\{[\s\S]*grid-column:\s*auto/s);
    expect(styles).toMatch(/\.prompt-bar textarea\s*\{[\s\S]*flex-basis:\s*auto/s);
    expect(styles).toMatch(/\.prompt-examples\s*\{[\s\S]*display:\s*flex/s);
    expect(styles).toMatch(/\.prompt-examples\s*\{[\s\S]*flex-wrap:\s*nowrap/s);
    expect(styles).toMatch(/\.prompt-example-chip\s*\{[\s\S]*flex:\s*0 0 auto/s);
  });

  it('keeps mobile editor buttons and icons visible in narrow controls', () => {
    expect(styles).toMatch(/\.project-group\s*\{[\s\S]*margin-left:\s*auto/s);
    expect(styles).toMatch(/\.project-title\s*\{[\s\S]*max-width:\s*48px/s);
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*430px\)\s*\{[\s\S]*\.toolbar-menu-shell:nth-child\(n \+ 3\)\s*\{[\s\S]*display:\s*none/s,
    );
    expect(styles).toMatch(
      /@media\s*\(max-width:\s*430px\)\s*\{[\s\S]*\.project-title\s*\{[\s\S]*max-width:\s*48px/s,
    );
    expect(styles).toMatch(/\.toolbar-icon-group\s*\{[\s\S]*display:\s*inline-flex/s);
    expect(styles).toMatch(/\.toolbar-icon-group \.stitch-icon-button\s*\{[\s\S]*width:\s*28px/s);
    expect(styles).toMatch(/\.toolbar-icon-group button\[aria-label='Undo'\]/s);
    expect(styles).toMatch(/\.export-button\s*\{[\s\S]*width:\s*36px/s);
    expect(styles).toMatch(/\.export-button\s*\{[\s\S]*height:\s*36px/s);
    expect(styles).toMatch(/\.project-play-menu-button\s*\{[\s\S]*width:\s*28px/s);
    expect(styles).toMatch(/\.scroll-page-actions\s*\{[\s\S]*max-width:\s*min\(208px,\s*58vw\)/s);
    expect(styles).toMatch(/\.scroll-page-actions \.icon-button\s*\{[\s\S]*flex:\s*0 0 28px/s);
    expect(styles).toMatch(/\.scroll-page-insert\s*\{[\s\S]*width:\s*32px/s);
    expect(styles).toMatch(/\.left-tool-button svg\s*\{[\s\S]*flex:\s*0 0 20px/s);
    expect(styles).toMatch(/\.prompt-submit-actions \.icon-button\s*\{[\s\S]*width:\s*34px/s);
    expect(styles).toMatch(/\.canvas-quick-actions button\s*\{[\s\S]*width:\s*36px/s);
    expect(styles).toMatch(/\.zoom-value\s*\{[\s\S]*min-height:\s*32px/s);
  });
});
