import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import {
  createFontContractProject,
  evaluateFontServiceContract,
} from './font-service-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Google and local font service contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateFontServiceContract, createFontContractProject());

  expect(result).toEqual({
    googleFontIds: ['google-fonts-arimo-italic-700'],
    googleResolutionStatuses: [
      'available-system',
      'missing-needs-user',
      'failed',
      'failed',
      'failed',
      'downloaded-compatible',
    ],
    googleWarningCodes: [
      'font-download-failed',
      'font-download-failed',
      'font-download-failed',
      'font-missing',
      'font-substituted',
    ],
    localAddedFamilies: ['Layout Serif:700', 'Project Sans:400', 'Project Sans:700'],
    localMissingWarnings: ['local-font-not-found', 'local-font-not-found'],
    localProgress: [
      'checking-local-fonts',
      'scanning-font-folder',
      'adding-project-fonts',
      'verifying-mirrored-fonts',
    ],
    missingFolderWarning: 'local-font-folder-missing',
    testFontWarning: 'Storage is ready, but Broken.ttf could not be loaded as a font.',
  });
});
