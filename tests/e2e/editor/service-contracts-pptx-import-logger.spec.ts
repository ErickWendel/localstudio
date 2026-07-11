import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluatePptxImportLoggerContract } from './pptx-import-logger-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes PPTX import logger contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluatePptxImportLoggerContract);

  expect(result.logs).toEqual(
    expect.arrayContaining([
      expect.stringContaining('[LocalStudio PPTX Import]'),
      expect.stringContaining('bad pptx'),
      expect.stringContaining('ObjectError'),
      expect.stringContaining('plain error'),
    ]),
  );
});
