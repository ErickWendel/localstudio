import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { createMirrorStorageContractProject } from './storage-contract-project';
import { evaluateStorageMirrorImportContract } from './storage-mirror-import-contract-browser';

test('executes mirror file import storage contracts in the browser runtime', async ({ page }) => {
  await installFakeOpfs(page, { directoryPicker: true });
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(
    evaluateStorageMirrorImportContract,
    createMirrorStorageContractProject(),
  );

  expect(result).toMatchObject({
    importedName: 'Mirrored Contract',
  });
  expect(result.importedAssetObjectUrl).toContain('blob:');
  expect(result.persistedKeys).toEqual(
    expect.arrayContaining([
      expect.stringContaining('Mirrored Contract/project.json'),
      expect.stringContaining('Mirrored Contract/assets/asset-kept.png'),
    ]),
  );
  expect(result.savedHandles).toEqual(
    expect.arrayContaining([expect.stringContaining('Mirrored Contract')]),
  );
});
