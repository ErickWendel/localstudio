import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type StorageMirrorImportContractResult = {
  importedAssetObjectUrl: string | undefined;
  importedName: string;
  persistedKeys: string[];
  savedHandles: string[];
};

export async function evaluateStorageMirrorImportContract(
  mirrorProject: ProjectDocument,
): Promise<StorageMirrorImportContractResult> {
  const { BrowserFileSystemProjectRepository } = (await import(
    '/editor/src/services/storage/browserFileSystemProjectRepository.ts'
  )) as typeof import('../../../apps/editor/src/services/storage/browserFileSystemProjectRepository');

  const savedHandles: string[] = [];
  const repository = new BrowserFileSystemProjectRepository({
    recentProjectStore: {
      load: () => Promise.resolve(null),
      save: (handle, projectName) => {
        savedHandles.push(`${handle.name}:${projectName ?? ''}`);
        return Promise.resolve();
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
}
