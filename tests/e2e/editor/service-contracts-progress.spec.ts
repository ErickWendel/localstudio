import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluateProgressContract } from './progress-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes model setup progress contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateProgressContract);

  expect(result.remainingMs).toBe(3000);
  expect(result.progressValues.at(0)).toBe(12);
  expect(result.progressValues.at(-1)).toBe(100);
});
