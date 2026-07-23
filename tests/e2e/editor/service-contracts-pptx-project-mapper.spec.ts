import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluatePptxProjectMapperContract } from './pptx-project-mapper-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes PPTX project mapper fallback layout contracts in the browser runtime', async ({
  page,
}) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluatePptxProjectMapperContract);

  expect(result).toEqual({
    assetIds: [
      'pptx-asset-1-wide-png',
      'pptx-asset-2-tall-png',
      'pptx-asset-3-clip-mp4',
    ],
    cropSummary: ['0.375:0:0.25:1', '0:0.4375:1:0.125'],
    fallbackLayoutElementIds: ['layout-title', 'layout-shape', 'layout-image'],
    layoutPlaceholderRoles: ['title', 'body'],
    missingAssetWarning: 'Referenced PowerPoint asset was not found: ppt/media/missing.png',
    pageAnimationBuildCount: 1,
    textFill: '#FFFFFF',
  });
});
