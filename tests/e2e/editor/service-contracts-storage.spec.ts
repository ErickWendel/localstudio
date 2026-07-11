/* eslint-disable @typescript-eslint/require-await */
import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { createStorageContractProject } from './storage-contract-project';

test('executes local file repository persistence and version contracts in the browser runtime', async ({
  page,
}) => {
  await page.addInitScript(installFakeOpfs, { directoryPicker: true });
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async (project) => {
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

    await repository.saveProjectAs(project, { projectDirectoryName: 'File Contract' });
    const loadedProject = await repository.loadProject();
    const version = await repository.saveVersion(
      {
        ...project,
        name: 'File Contract v2',
        elements: {
          ...project.elements,
          'image-1': { ...project.elements['image-1'], x: 42 },
        },
      },
      { previousProject: project },
    );
    const history = await repository.getVersionHistory();
    const loadedVersion = await repository.loadVersion(version.id);
    const missingVersion = await repository.loadVersion('missing-version');
    const persistedKeys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    )
      .filter((key): key is string => Boolean(key))
      .filter((key) => key.includes('localstudio.e2e.opfs.file:'))
      .sort();

    return {
      historyCount: history.length,
      loadedAssetStorage: loadedProject?.assets['asset-kept']?.storage,
      loadedFontStorage: loadedProject?.fonts?.inter?.storage,
      loadedName: loadedProject?.name,
      loadedVersionName: loadedVersion?.name,
      missingVersion,
      persistedKeys,
      savedHandles,
      versionSummary: version.summary,
    };
  }, createStorageContractProject());

  expect(result).toMatchObject({
    historyCount: 1,
    loadedAssetStorage: 'file',
    loadedFontStorage: 'file',
    loadedName: 'File Contract',
    loadedVersionName: 'File Contract v2',
    missingVersion: null,
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
