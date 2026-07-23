import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluateEditorHelperCoverageContract } from './editor-helper-coverage-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes editor visual and crop helper contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateEditorHelperCoverageContract);

  expect(result.cropFrames).toEqual([
    { height: 240, width: 240, x: 120, y: 60 },
    { height: 160, width: 320, x: 40, y: 140 },
    { height: 360, width: 480, x: -120, y: -60 },
    { height: 360, width: 480, x: 40, y: 60 },
  ]);
  expect(result.cropRects).toEqual([
    { height: 0.5, width: 0.375, x: 0.375, y: 0.25 },
    { height: 0.3333, width: 0.5, x: 0.25, y: 0.4167 },
    { height: 0.75, width: 0.75, x: 0, y: 0 },
    { height: 0.75, width: 0.75, x: 0.25, y: 0.25 },
  ]);
  expect(result.normalizedCrop).toEqual({ height: 1, width: 1, x: 0, y: 0 });
  expect(result.opacities).toEqual([0.42, 0.25]);
  expect(result.visualColors).toEqual(['#E0E0E0', '#334D66', '#ABCDEF']);
  expect(result.exportSummary).toBe(
    'PowerPoint exported: 1 slide, 3 media items, 2 animation builds; 1 animation fallback, 1 transition fallback, 1 media fallback, 1 fallback.',
  );
  expect(result.exportProgress).toEqual({
    detail: 'Writing slides',
    message: 'Exporting diagnostics',
    progress: { current: 10, total: 10 },
    tone: 'info',
  });
  expect(result.emptyProgress).toEqual({
    detail: undefined,
    message: 'Exporting without totals',
    progress: undefined,
    tone: 'info',
  });
  expect(result.shapeLabels).toEqual(['Parallelogram', 'Rounded rectangle']);
  expect(result.polygonPoints[0]).toEqual([24, 0, 100, 0, 76, 50, 0, 50]);
  expect(result.polygonPoints[1]).toEqual([
    50, 0, 97.55, 34.55, 79.39, 90.45, 20.61, 90.45, 2.45, 34.55,
  ]);
  expect(result.generatedPageName).toBe('Generated helper slide');
  expect(result.generatedElementIds).toEqual([
    'generated-page-1-remote-hero',
    'generated-page-1-shape-stroked',
  ]);
  expect(result.generatedAssetIds).toEqual(['asset-remote-ahr0chm6ly9legft']);
});
