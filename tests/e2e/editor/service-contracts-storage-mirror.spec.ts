/* eslint-disable @typescript-eslint/require-await */
import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { createMirrorStorageContractProject } from './storage-contract-project';

test('executes mirror file import storage contracts in the browser runtime', async ({ page }) => {
  await page.addInitScript(installFakeOpfs, { directoryPicker: true });
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async (mirrorProject) => {
    const { BrowserFileSystemProjectRepository } = (await import(
      '/editor/src/services/storage/browserFileSystemProjectRepository.ts'
    )) as typeof import('../../../apps/editor/src/services/storage/browserFileSystemProjectRepository');

    const savedHandles: string[] = [];
    const repository = new BrowserFileSystemProjectRepository({
      recentProjectStore: {
        load: async () => null,
        save: async (handle, projectName) => {
          savedHandles.push(`${handle.name}:${projectName ?? ''}`);
        },
      },
    });
    const importedProject = await repository.importMirrorFiles([
      {
        blob: new Blob([JSON.stringify(mirrorProject)], { type: 'application/json' }),
        path: 'project.json',
      },
      {
        blob: new Blob(['mirror-image'], { type: 'image/png' }),
        path: 'assets/asset-kept.png',
      },
      {
        blob: new Blob([JSON.stringify({ schemaVersion: 1, versions: [] })], {
          type: 'application/json',
        }),
        path: 'history/manifest.json',
      },
    ]);
    const persistedKeys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    )
      .filter((key): key is string => Boolean(key))
      .filter((key) => key.includes('localstudio.e2e.opfs.file:'))
      .sort();

    return {
      importedAssetObjectUrl: importedProject.assets['asset-kept']?.objectUrl,
      importedName: importedProject.name,
      persistedKeys,
      savedHandles,
    };
  }, createMirrorStorageContractProject());

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
