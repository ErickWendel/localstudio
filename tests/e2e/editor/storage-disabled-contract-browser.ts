import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type StorageDisabledContractResult = {
  disabledLoad: ProjectDocument | null;
  permissionError: string;
};

export async function evaluateStorageDisabledContract(
  project: ProjectDocument,
): Promise<StorageDisabledContractResult> {
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
    pickDirectory: () =>
      Promise.resolve({
        name: 'denied-root',
        queryPermission: () => Promise.resolve('denied' as PermissionState),
        requestPermission: () => Promise.resolve('denied' as PermissionState),
      } as unknown as FileSystemDirectoryHandle),
    recentProjectStore: {
      load: () => Promise.resolve(null),
      save: () => Promise.resolve(undefined),
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
}
