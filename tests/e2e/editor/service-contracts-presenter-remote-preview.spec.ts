import { presenterRemotePreviewContractRuntimePage } from './presenter-remote-preview-contract-runtime-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter remote preview thumbnail contracts in the browser runtime', async ({
  page,
}) => {
  const result = await presenterRemotePreviewContractRuntimePage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    edgeBatchCount: 1,
    edgeStatePageCount: 3,
    previewBatchCount: 1,
    timerGuardResults: [true, true, false, false],
  });
  expect(result.elementKinds).toEqual(
    expect.arrayContaining(['image', 'media', 'shape', 'text']),
  );
  expect(result.backgroundImage).toContain('data:image/jpeg;base64,');
  expect(result.mediaUrls).toEqual(
    expect.arrayContaining([
      expect.stringContaining('data:image/gif;base64'),
      expect.stringContaining('data:image/jpeg;base64,'),
    ]),
  );
});
