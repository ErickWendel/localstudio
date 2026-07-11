/* eslint-disable @typescript-eslint/require-await */
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { createStorageContractProject } from './storage-contract-project';

test('executes disabled and denied project repository contracts in the browser runtime', async ({
  page,
}) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async (project) => {
    const [{ BrowserFileSystemProjectRepository }, { DisabledProjectRepository }] =
      (await Promise.all([
        import('/editor/src/services/storage/browserFileSystemProjectRepository.ts'),
        import('/editor/src/services/storage/disabledProjectRepository.ts'),
      ])) as [
        typeof import('../../../apps/editor/src/services/storage/browserFileSystemProjectRepository'),
        typeof import('../../../apps/editor/src/services/storage/disabledProjectRepository'),
      ];

    const disabledRepository = new DisabledProjectRepository();
    await disabledRepository.saveProject(project);
    const disabledLoad = await disabledRepository.loadProject();

    const deniedRepository = new BrowserFileSystemProjectRepository({
      pickDirectory: async () =>
        ({
          name: 'denied-root',
          queryPermission: async () => 'denied',
          requestPermission: async () => 'denied',
        }) as unknown as FileSystemDirectoryHandle,
      recentProjectStore: {
        load: async () => null,
        save: async () => undefined,
      },
    });
    const permissionError = await deniedRepository
      .saveProject(project)
      .then(() => '')
      .catch((error) => (error instanceof Error ? error.message : String(error)));

    return {
      disabledLoad,
      permissionError,
    };
  }, createStorageContractProject());

  expect(result).toEqual({
    disabledLoad: null,
    permissionError:
      'LocalStudio.dev needs permission to read and write the selected project folder.',
  });
});
