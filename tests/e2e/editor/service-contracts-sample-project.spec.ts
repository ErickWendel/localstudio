/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes sample project contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async () => {
    const { sampleProject } = (await import(
      '/editor/src/domain/projects/sampleProject.ts'
    )) as typeof import('../../../apps/editor/src/domain/projects/sampleProject');

    const blank = sampleProject.createBlankProject();
    const sample = sampleProject.createSampleProject();

    return {
      blankBackground: blank.pages[0]?.background,
      blankElementCount: Object.keys(blank.elements).length,
      blankName: blank.name,
      sampleAssetUrl: sample.assets['asset-hero']?.objectUrl,
      sampleElementIds: sample.pages[0]?.elementIds,
      sampleTitle: sample.elements['text-title']?.text,
    };
  });

  expect(result).toMatchObject({
    blankBackground: { color: '#050D10', type: 'color' },
    blankElementCount: 0,
    blankName: 'Untitled Project',
    sampleTitle: 'AI Design Revolution',
  });
  expect(result.sampleAssetUrl).toContain('encrypted-tbn0.gstatic.com');
  expect(result.sampleElementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);
});
