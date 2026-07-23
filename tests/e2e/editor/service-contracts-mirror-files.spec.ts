import { mirrorFileContractRuntimePage } from './mirror-file-contract-runtime-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes mirror file generation contracts in the browser runtime', async ({ page }) => {
  const result = await mirrorFileContractRuntimePage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    defaultPublicBaseUrl: 'https://bucket.s3.example.test',
    mirroredAssetIds: ['asset-unreadable', 'asset-used'],
    mirroredFontStorage: 'file',
    mirroredProjectAssetStorage: 'file',
    mirroredRecordingObjectUrl: undefined,
    mirroredRecordingStorage: 'file',
    mirroredProjectUnreadableObjectUrl: 'https://example.test/unreadable.png',
  });
  expect(result.manifest).toMatchObject({
    projectId: 'project-mirror-contract',
    projectName: 'Mirror Contract',
    publicBaseUrl: 'https://cdn.example.test/public',
    schemaVersion: 1,
    syncedAt: '2026-07-09T12:34:00.000Z',
  });
  expect(result.mirrorFilePaths).toEqual(
    expect.arrayContaining([
      'assets/asset-used.png',
      'config/localstudio.json',
      'fonts/inter.woff2',
      'history/manifest.json',
      'history/versions/version-1.json',
      'localstudio-mirror.json',
      'project.json',
      'recordings/recording-readable.webm',
    ]),
  );
});
