import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluatePresenterLoggingContract } from './presenter-logging-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter debug logging contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluatePresenterLoggingContract, {
    presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
  });

  expect(result.logs).toEqual(
    expect.arrayContaining([
      expect.stringContaining('info:[LocalStudio presenter remote]|enabled'),
      expect.stringContaining('warn:[LocalStudio presenter remote]|object|{"ok":true}'),
      expect.stringContaining('error:[LocalStudio presenter remote]|failure|TypeError: bad stream'),
      expect.stringContaining('warn:[LocalStudio presenter remote]|circular|[object Object]'),
    ]),
  );
  expect(result.logs).not.toEqual(
    expect.arrayContaining([expect.stringContaining('info:[LocalStudio presenter remote]|ready')]),
  );
});
