import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluateSampleProjectContract } from './sample-project-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes sample project contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateSampleProjectContract);

  expect(result).toMatchObject({
    blankBackground: { color: '#050D10', type: 'color' },
    blankElementCount: 0,
    blankName: 'Untitled Project',
    sampleTitle: 'AI Design Revolution',
  });
  expect(result.sampleAssetUrl).toContain('encrypted-tbn0.gstatic.com');
  expect(result.sampleElementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);
});
