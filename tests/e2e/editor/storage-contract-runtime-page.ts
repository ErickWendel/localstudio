/* eslint-disable @typescript-eslint/require-await */
import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { createStorageContractProject } from './storage-contract-project';

export const storageContractRuntimePage = {
  async run(page: Page, baseURL: string) {
    await installFakeOpfs(page, { directoryPicker: true });
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(async (project) => {
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
  },
};
