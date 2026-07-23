import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { evaluateTranscriptEmbeddingContract } from './transcript-embedding-contract-browser';

test('executes transcript embedding runtime client contracts in the browser runtime', async ({
  page,
}) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateTranscriptEmbeddingContract);

  expect(result).toEqual({
    embedTexts: ['query alpha', 'fail'],
    errorMessage: 'embedding failed',
    ignoredUnknownResponse: true,
    preloadProgress: [25],
    searchIds: ['alpha'],
    terminated: true,
  });
});
