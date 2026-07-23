import { storageContractRuntimePage } from './storage-contract-runtime-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes local file repository persistence and version contracts in the browser runtime', async ({
  page,
}) => {
  const result = await storageContractRuntimePage.run(page, serviceContractsSupport.getServer().baseURL);

  expect(result).toMatchObject({
    browserMissingMirrorProjectMessage: 'The mirrored project did not include project.json.',
    browserRemoteAssetObjectUrl: expect.stringContaining('blob:'),
    fileBackedAssetObjectUrl: expect.stringContaining('blob:'),
    fileBackedFontObjectUrl: expect.stringContaining('blob:'),
    fileBackedRecordingObjectUrl: expect.stringContaining('blob:'),
    historyCount: 1,
    inlineRecordingStorage: 'file',
    loadedAssetStorage: 'file',
    loadedFontStorage: 'file',
    loadedName: 'File Contract',
    loadedVersionName: 'File Contract v2',
    missingVersion: null,
    opfsMissingMirrorProjectMessage: 'The mirrored project did not include project.json.',
    opfsRemoteAssetObjectUrl: expect.stringContaining('blob:'),
    opfsImportedName: '',
    opfsLoadedName: 'File Contract',
    opfsMissingProject: null,
    pickerImportedName: 'Prepared Picker Import',
    permissionDeniedMessage:
      'LocalStudio.dev needs permission to read and write the selected project folder.',
  });
  expect(result.persistedKeys).toEqual(
    expect.arrayContaining([
      expect.stringContaining('File Contract/project.json'),
      expect.stringContaining('File Contract/config/localstudio.json'),
      expect.stringContaining('File Contract/assets/asset-kept.png'),
      expect.stringContaining('File Contract/fonts/inter.woff2'),
      expect.stringContaining('File Contract v2/history/manifest.json'),
      expect.stringContaining('File Contract v2/history/versions/'),
    ]),
  );
  expect(result.savedHandles).toEqual(expect.arrayContaining([expect.stringContaining('File Contract')]));
  expect(result.versionSummary).toContain('edits');
});
