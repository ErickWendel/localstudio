import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes PPTX import logger contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async () => {
    const { pptxImportLogger } = (await import(
      '/editor/src/services/importing/pptx/pptxImportLogger.ts'
    )) as typeof import('../../../apps/editor/src/services/importing/pptx/pptxImportLogger');

    const logs: string[] = [];
    const originalInfo = console.info;
    const originalError = console.error;
    console.info = (...values: unknown[]) => logs.push(`info:${JSON.stringify(values)}`);
    console.error = (...values: unknown[]) => logs.push(`error:${JSON.stringify(values)}`);
    pptxImportLogger.info('started');
    pptxImportLogger.info('with details', { slideCount: 2 });
    pptxImportLogger.error('failed', new TypeError('bad pptx'), { fileName: 'broken.pptx' });
    pptxImportLogger.error('object failed', { message: 'object message', name: 'ObjectError' });
    pptxImportLogger.error('plain failed', 'plain error');
    console.info = originalInfo;
    console.error = originalError;

    return { logs };
  });

  expect(result.logs).toEqual(
    expect.arrayContaining([
      expect.stringContaining('[LocalStudio PPTX Import]'),
      expect.stringContaining('bad pptx'),
      expect.stringContaining('ObjectError'),
      expect.stringContaining('plain error'),
    ]),
  );
});
