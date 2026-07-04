import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesPath = resolve(__dirname, '../../../../src/ui/styles.css');
const stylesDirectory = resolve(__dirname, '../../../../src/ui/styles');
const maxOwnedStylesheetLines = 420;

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

  it('keeps import progress overlays styled after stylesheet composition', () => {
    expect(styles).toMatch(/\.presentation-import-backdrop\s*\{[\s\S]*position:\s*fixed/s);
    expect(styles).toMatch(/\.presentation-import-backdrop\s*\{[\s\S]*z-index:\s*420/s);
    expect(styles).toMatch(/\.presentation-import-panel\s*\{[\s\S]*width:\s*min\(520px,\s*100%\)/s);
    expect(styles).toMatch(/\.presentation-import-orbit span\s*\{[\s\S]*animation:\s*presentationImportOrbit/s);
    expect(styles).toMatch(/@keyframes\s+presentationImportOrbit/s);
    expect(styles).toMatch(/\.media-import-info-icon\s*\{[\s\S]*display:\s*grid/s);
  });

  it('keeps critical split stylesheet selectors in the composed editor CSS', () => {
    const criticalSelectors = [
      '.prompt-examples',
      '.prompt-example-chip',
      '.prompt-bar',
      '.prompt-input-cluster',
      '.prompt-mode-token',
      '.presentation-import-backdrop',
      '.presentation-import-orbit',
      '.image-size-presets',
      '.image-size-preset',
      '.image-crop-frame',
      '.image-crop-handle',
      '.text-selection-toolbar',
      '.floating-toolbar',
      '.canvas-quick-actions',
      '.public-deck-viewer',
      '.share-panel',
      '.presenter-view',
      '.keyboard-shortcuts-dialog',
    ];

    for (const selector of criticalSelectors) {
      expect(styles, `${selector} should be present in composed editor styles`).toContain(selector);
    }
  });

  it('keeps presenter next-slide thumbnails bounded by the strip height', () => {
    expect(styles).toMatch(/\.presenter-slide-strip\s*\{[\s\S]*--presenter-thumb-preview-height:/s);
    expect(styles).toMatch(/\.presenter-slide-strip\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*var\(--presenter-thumb-preview-width\)\)\)/s);
    expect(styles).toMatch(/\.presenter-thumb\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*var\(--presenter-thumb-preview-height\)\)/s);
    expect(styles).toMatch(/\.presenter-thumb-canvas\s*\{[\s\S]*height:\s*var\(--presenter-thumb-preview-height\)/s);
    expect(styles).toMatch(/\.presenter-thumb-canvas\s*\{[\s\S]*width:\s*var\(--presenter-thumb-preview-width\)/s);
  });

  it('keeps editor styles split into a manifest and small owned files', () => {
    const manifest = readFileSync(stylesPath, 'utf8');
    const manifestViolations = manifest
      .split('\n')
      .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
      .filter(({ line }) => line && !line.startsWith('@import '));

    expect(manifestViolations).toEqual([]);

    const oversizedStylesheets = readdirSync(stylesDirectory)
      .filter((fileName) => fileName.endsWith('.css'))
      .map((fileName) => {
        const filePath = resolve(stylesDirectory, fileName);
        const lineCount = readFileSync(filePath, 'utf8').trimEnd().split('\n').length;
        return { fileName, lineCount };
      })
      .filter(({ lineCount }) => lineCount > maxOwnedStylesheetLines);

    expect(oversizedStylesheets).toEqual([]);
  });
});
