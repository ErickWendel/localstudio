import { minioMirrorServiceContractRuntimePage } from './minio-mirror-service-contract-runtime-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes MinIO mirror service contracts in the browser runtime', async ({ page }) => {
  const result = await minioMirrorServiceContractRuntimePage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    deleteError: 'Could not list MinIO mirror objects (500).',
    deleteObjectError: 'Could not delete mirrored object mirrors/project/assets/image.png (500).',
    downloadedPaths: ['fallback-path.json', 'localstudio-mirror.json', 'media.bin'],
    downloadFileError: 'Could not download mirrored file project.json (500).',
    listError: 'Could not list MinIO mirrors (500).',
    listOrder: ['Zulu Project', 'Beta Project', 'Alpha Project'],
    uploadError: 'Could not upload mirrors/share.json to MinIO (500).',
  });
  expect(result.downloadProgress).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ currentFile: undefined, downloadedBytes: 0, downloadedFiles: 0 }),
      expect.objectContaining({ currentFile: 'media.bin', downloadedBytes: 3, downloadedFiles: 2 }),
    ]),
  );
});
