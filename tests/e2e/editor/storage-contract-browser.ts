import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type StorageContractResult = {
  browserMissingMirrorProjectMessage: string;
  browserRemoteAssetObjectUrl: string | undefined;
  fileBackedAssetObjectUrl: string | undefined;
  fileBackedFontObjectUrl: string | undefined;
  fileBackedRecordingObjectUrl: string | undefined;
  historyCount: number;
  inlineRecordingStorage: string | undefined;
  loadedAssetStorage: string | undefined;
  loadedFontStorage: string | undefined;
  loadedName: string | undefined;
  loadedVersionName: string | undefined;
  missingVersion: ProjectDocument | null;
  opfsMissingMirrorProjectMessage: string;
  opfsRemoteAssetObjectUrl: string | undefined;
  opfsImportedName: string;
  opfsLoadedName: string | undefined;
  opfsMissingProject: ProjectDocument | null;
  persistedKeys: string[];
  pickerImportedName: string | undefined;
  permissionDeniedMessage: string;
  recentStoreErrorMessages: string[];
  savedHandles: string[];
  versionSummary: string;
};

export async function evaluateStorageContract(
  project: ProjectDocument,
): Promise<StorageContractResult> {
  const { BrowserFileSystemProjectRepository } = (await import(
    '/editor/src/services/storage/browserFileSystemProjectRepository.ts'
  )) as typeof import('../../../apps/editor/src/services/storage/browserFileSystemProjectRepository');
  const { OpfsProjectRepository } = (await import(
    '/editor/src/services/storage/opfsProjectRepository.ts'
  )) as typeof import('../../../apps/editor/src/services/storage/opfsProjectRepository');

  function buildDirectoryHandle(name: string, permission: PermissionState = 'granted') {
    const storageKeyPrefix = 'localstudio.e2e.opfs.file:';
    const normalizePath = (path: string) => path.split('/').filter(Boolean).join('/');
    const fileKey = (path: string) => `${storageKeyPrefix}${normalizePath(path)}`;

    class ContractFileHandle {
      readonly kind = 'file';

      constructor(
        readonly name: string,
        private readonly path: string,
      ) {}

      async getFile() {
        await Promise.resolve();
        const value = window.localStorage.getItem(fileKey(this.path));
        if (value === null) throw new DOMException('File not found.', 'NotFoundError');
        return new File([value], this.name, { type: 'application/json' });
      }

      async createWritable() {
        await Promise.resolve();
        const path = this.path;
        let chunks = '';
        return {
          async close() {
            await Promise.resolve();
            window.localStorage.setItem(fileKey(path), chunks);
          },
          async write(value: BlobPart) {
            chunks += typeof value === 'string' ? value : await new Blob([value]).text();
          },
        };
      }
    }

    class ContractDirectoryHandle {
      readonly kind = 'directory';

      constructor(
        readonly name: string,
        private readonly path = name,
      ) {}

      async queryPermission() {
        await Promise.resolve();
        return permission;
      }

      async requestPermission() {
        await Promise.resolve();
        return permission;
      }

      async getDirectoryHandle(directoryName: string, options: { create?: boolean } = {}) {
        await Promise.resolve();
        const path = normalizePath(`${this.path}/${directoryName}`);
        if (!options.create && !hasDirectory(path)) {
          throw new DOMException('Directory not found.', 'NotFoundError');
        }
        return new ContractDirectoryHandle(directoryName, path);
      }

      async getFileHandle(fileName: string, options: { create?: boolean } = {}) {
        await Promise.resolve();
        const path = normalizePath(`${this.path}/${fileName}`);
        if (!options.create && window.localStorage.getItem(fileKey(path)) === null) {
          throw new DOMException('File not found.', 'NotFoundError');
        }
        return new ContractFileHandle(fileName, path);
      }

      async removeEntry(entryName: string, options: { recursive?: boolean } = {}) {
        await Promise.resolve();
        const path = normalizePath(`${this.path}/${entryName}`);
        const targetFileKey = fileKey(path);
        if (window.localStorage.getItem(targetFileKey) !== null) {
          window.localStorage.removeItem(targetFileKey);
          return;
        }
        if (!options.recursive && hasDirectory(path)) {
          throw new DOMException('Directory not empty.', 'InvalidModificationError');
        }
        for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
          const key = window.localStorage.key(index);
          if (key?.startsWith(`${targetFileKey}/`)) window.localStorage.removeItem(key);
        }
      }

      async *entries(): AsyncIterable<[string, { kind: string }]> {
        await Promise.resolve();
        const prefix = normalizePath(this.path);
        const seen = new Set<string>();
        for (let index = 0; index < window.localStorage.length; index += 1) {
          const key = window.localStorage.key(index);
          if (!key?.startsWith(fileKey(''))) continue;
          const path = key.slice(fileKey('').length);
          if (prefix && !path.startsWith(`${prefix}/`)) continue;
          const relativePath = prefix ? path.slice(prefix.length + 1) : path;
          const [entryName, ...rest] = relativePath.split('/');
          if (!entryName || seen.has(entryName)) continue;
          seen.add(entryName);
          yield [
            entryName,
            rest.length > 0
              ? new ContractDirectoryHandle(entryName, normalizePath(`${prefix}/${entryName}`))
              : new ContractFileHandle(entryName, normalizePath(`${prefix}/${entryName}`)),
          ];
        }
      }
    }

    function hasDirectory(path: string) {
      const prefix = `${fileKey(path)}/`;
      for (let index = 0; index < window.localStorage.length; index += 1) {
        if (window.localStorage.key(index)?.startsWith(prefix)) return true;
      }
      return false;
    }

    return new ContractDirectoryHandle(name) as unknown as FileSystemDirectoryHandle;
  }

  async function importViaPreparedPicker(pickedDirectories: FileSystemDirectoryHandle[]) {
    const parentDirectory = buildDirectoryHandle('prepared-parent');
    pickedDirectories.push(parentDirectory);
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(pickedDirectories.shift() ?? parentDirectory),
    });

    await repository.prepareImportMirrorFiles();
    const imported = await repository.importMirrorFiles([
      {
        blob: new Blob([JSON.stringify({ ...project, name: 'Prepared Picker Import' })], {
          type: 'application/json',
        }),
        path: 'project.json',
      },
      {
        blob: new Blob(['prepared-image'], { type: 'image/png' }),
        path: 'assets/asset-kept.png',
      },
    ]);
    return imported.name;
  }

  async function readPermissionDeniedMessage() {
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(buildDirectoryHandle('denied-root', 'denied')),
    });
    try {
      await repository.saveProjectAs(project);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    return 'missing-error';
  }

  async function seedRecentProjectStore() {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open('localstudio-ai-recent-projects', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('handles');
      };
      request.onerror = () => reject(request.error ?? new Error('recent store open failed'));
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('handles', 'readwrite');
      const store = transaction.objectStore('handles');
      store.put({ name: 'Recent Last' }, 'last-project-directory');
      store.put({ name: 'Recent Named' }, 'project-directory:recent contract');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('recent seed failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('recent seed aborted'));
    });
    database.close();
    window.localStorage.setItem('localstudio.ai.last-project.available', 'true');
  }

  async function evaluateDefaultRecentProjectStoreErrors() {
    const messages: string[] = [];
    await seedRecentProjectStore();
    const capture = async (operation: () => Promise<unknown>) => {
      try {
        await operation();
      } catch (error) {
        messages.push(error instanceof Error ? error.message : String(error));
      }
    };
    await capture(() => new BrowserFileSystemProjectRepository().loadProject());
    await capture(() =>
      new BrowserFileSystemProjectRepository().loadProject({ projectName: 'Recent Contract' }),
    );
    const directoryPickerWindow = window as Window & {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    };
    const originalDirectoryPicker = directoryPickerWindow.showDirectoryPicker;
    try {
      Reflect.deleteProperty(directoryPickerWindow, 'showDirectoryPicker');
      await capture(() => new BrowserFileSystemProjectRepository().saveProjectAs(project));
    } finally {
      if (originalDirectoryPicker) {
        Object.defineProperty(directoryPickerWindow, 'showDirectoryPicker', {
          configurable: true,
          value: originalDirectoryPicker,
        });
      }
    }
    return messages;
  }

  async function evaluateOpfsStorageContract() {
    const rootDirectory = buildDirectoryHandle('opfs-contract-root');
    const storage = new Map<string, string>();
    const fetchRemoteAsset = () =>
      Promise.resolve(new Response('remote-opfs-image', { headers: { 'content-type': 'image/png' } }));
    const repository = new OpfsProjectRepository({
      fetch: fetchRemoteAsset,
      getRootDirectory: () => Promise.resolve(rootDirectory),
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        removeItem: (key) => {
          storage.delete(key);
        },
        setItem: (key, value) => {
          storage.set(key, value);
        },
      },
    });

    await repository.saveProjectAs(project, { projectDirectoryName: 'OPFS Saved.Contract' });
    const opfsProjectPath = 'opfs-contract-root/projects/OPFS%20Saved%2EContract';
    seedFile(`${opfsProjectPath}/assets/asset-file-backed.png`, 'opfs-file-backed-image');
    seedFile(`${opfsProjectPath}/fonts/archived.woff2`, 'opfs-file-backed-font');
    seedFile(
      `${opfsProjectPath}/recordings/recording-file-backed.webm`,
      'opfs-file-backed-recording',
    );
    const loaded = await repository.loadProject({ projectName: 'OPFS Saved.Contract' });
    const remoteProjectName = 'OPFS Remote.Contract';
    const remoteProjectPath = 'opfs-contract-root/projects/OPFS%20Remote%2EContract';
    seedFile(
      `${remoteProjectPath}/project.json`,
      JSON.stringify({
        ...project,
        assets: {
          remote: {
            id: 'remote',
            mimeType: 'image/png',
            name: 'Remote image',
            objectUrl: 'https://assets.localstudio.test/opfs-remote.png',
            storage: 'remote',
            type: 'image',
          },
        },
        fonts: {},
        name: remoteProjectName,
        recordings: {},
      } satisfies ProjectDocument),
    );
    const remoteLoaded = await repository.loadProject({ projectName: remoteProjectName });
    const imported = await repository.importMirrorFiles([
      {
        blob: new Blob([JSON.stringify({ ...project, name: '' })], { type: 'application/json' }),
        path: 'project.json',
      },
    ]);
    const emptyMirrorRepository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(buildDirectoryHandle('opfs-empty-mirror-root')),
      storage: {
        getItem: () => null,
        removeItem: () => undefined,
        setItem: () => undefined,
      },
    });
    const missingMirrorProjectMessage = await emptyMirrorRepository
      .importMirrorFiles([{ blob: new Blob(['no-project'], { type: 'text/plain' }), path: 'notes.txt' }])
      .then(() => 'missing-error', (error: unknown) =>
        error instanceof Error ? error.message : String(error),
      );
    const missingProject = await repository.loadProject({ projectName: 'Missing OPFS Contract' });

    return {
      importedName: imported.name,
      loadedName: loaded?.name,
      missingMirrorProjectMessage,
      missingProject,
      remoteAssetObjectUrl: remoteLoaded?.assets.remote?.objectUrl,
    };
  }

  async function evaluateBrowserRemoteAndMirrorErrors() {
    const rootDirectory = buildDirectoryHandle('browser-remote-root');
    const remoteProject: ProjectDocument = {
      ...project,
      assets: {
        remote: {
          id: 'remote',
          mimeType: 'image/png',
          name: 'Browser remote image',
          objectUrl: 'https://assets.localstudio.test/browser-remote.png',
          storage: 'remote',
          type: 'image',
        },
      },
      fonts: {},
      name: 'Browser Remote Contract',
      recordings: {},
    };
    const remoteDirectory = await rootDirectory.getDirectoryHandle(remoteProject.name, {
      create: true,
    });
    const projectFile = await remoteDirectory.getFileHandle('project.json', { create: true });
    const writable = await projectFile.createWritable();
    await writable.write(JSON.stringify(remoteProject));
    await writable.close();
    const repository = new BrowserFileSystemProjectRepository({
      fetch: () =>
        Promise.resolve(
          new Response('remote-browser-image', { headers: { 'content-type': 'image/png' } }),
        ),
      recentProjectStore: {
        load: () => Promise.resolve(remoteDirectory),
        save: () => Promise.resolve(),
      },
    });
    const loaded = await repository.loadProject();
    const missingMirrorProjectMessage = await repository
      .importMirrorFiles([{ blob: new Blob(['no-project'], { type: 'text/plain' }), path: 'notes.txt' }])
      .then(() => 'missing-error', (error: unknown) =>
        error instanceof Error ? error.message : String(error),
      );
    return {
      missingMirrorProjectMessage,
      remoteAssetObjectUrl: loaded?.assets.remote?.objectUrl,
    };
  }

  const savedHandles: string[] = [];
  const pickedDirectories: FileSystemDirectoryHandle[] = [];
  let contractStep = 'setup';
  const repository = new BrowserFileSystemProjectRepository({
    pickDirectory: () => Promise.resolve(pickedDirectories.shift() ?? buildDirectoryHandle('picked-root')),
    recentProjectStore: {
      load: () => Promise.resolve(null),
      save: (handle, projectName) => {
        savedHandles.push(`${handle.name}:${projectName ?? ''}`);
        return Promise.resolve();
      },
    },
  });

  try {
    contractStep = 'saveProjectAs';
    await repository.saveProjectAs(project, { projectDirectoryName: 'File Contract' });
    contractStep = 'seedFileBackedFiles';
    seedFile('picked-root/File Contract/assets/asset-file-backed.png', 'file-backed-image');
    seedFile('picked-root/File Contract/fonts/archived.woff2', 'file-backed-font');
    seedFile(
      'picked-root/File Contract/recordings/recording-file-backed.webm',
      'file-backed-recording',
    );
    contractStep = 'loadProject';
  } catch (error) {
    throw new Error(
      `${contractStep}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      { cause: error },
    );
  }
  let firstLoadedProject: ProjectDocument | null;
  try {
    firstLoadedProject = await repository.loadProject();
  } catch (error) {
    throw new Error(
      `${contractStep}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
      { cause: error },
    );
  }
  async function runStep<T>(step: string, task: () => Promise<T>) {
    contractStep = step;
    try {
      return await task();
    } catch (error) {
      throw new Error(
        `${contractStep}: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
        { cause: error },
      );
    }
  }
  const version = await runStep('saveVersion', () =>
    repository.saveVersion(
    {
      ...project,
      name: 'File Contract v2',
      elements: {
        ...project.elements,
        'image-1': { ...project.elements['image-1'], x: 42 },
      },
    },
    { previousProject: project },
    ),
  );
  const history = await runStep('getVersionHistory', () => repository.getVersionHistory());
  const loadedVersion = await runStep('loadVersion', () => repository.loadVersion(version.id));
  const missingVersion = await runStep('loadMissingVersion', () =>
    repository.loadVersion('missing-version'),
  );
  const pickerImportedName = await runStep('importViaPreparedPicker', () =>
    importViaPreparedPicker(pickedDirectories),
  );
  const permissionDeniedMessage = await runStep('readPermissionDeniedMessage', () =>
    readPermissionDeniedMessage(),
  );
  const opfsResult = await runStep('evaluateOpfsStorageContract', () =>
    evaluateOpfsStorageContract(),
  );
  const browserRemoteResult = await runStep('evaluateBrowserRemoteAndMirrorErrors', () =>
    evaluateBrowserRemoteAndMirrorErrors(),
  );
  const recentStoreErrorMessages = await runStep('evaluateDefaultRecentProjectStoreErrors', () =>
    evaluateDefaultRecentProjectStoreErrors(),
  );
  const persistedKeys = Array.from(
    { length: window.localStorage.length },
    (_, index) => window.localStorage.key(index),
  )
    .filter((key): key is string => Boolean(key))
    .filter((key) => key.includes('localstudio.e2e.opfs.file:'))
    .sort();

  return {
    browserMissingMirrorProjectMessage: browserRemoteResult.missingMirrorProjectMessage,
    browserRemoteAssetObjectUrl: browserRemoteResult.remoteAssetObjectUrl,
    fileBackedAssetObjectUrl: firstLoadedProject?.assets['asset-file-backed']?.objectUrl,
    fileBackedFontObjectUrl: firstLoadedProject?.fonts?.archived?.objectUrl,
    fileBackedRecordingObjectUrl:
      firstLoadedProject?.recordings?.['recording-file-backed']?.audio.objectUrl,
    historyCount: history.length,
    inlineRecordingStorage: loadedVersion?.recordings?.['recording-inline']?.audio.storage,
    loadedAssetStorage: firstLoadedProject?.assets['asset-kept']?.storage,
    loadedFontStorage: firstLoadedProject?.fonts?.inter?.storage,
    loadedName: firstLoadedProject?.name,
    loadedVersionName: loadedVersion?.name,
    missingVersion,
    opfsMissingMirrorProjectMessage: opfsResult.missingMirrorProjectMessage,
    opfsRemoteAssetObjectUrl: opfsResult.remoteAssetObjectUrl,
    opfsImportedName: opfsResult.importedName,
    opfsLoadedName: opfsResult.loadedName,
    opfsMissingProject: opfsResult.missingProject,
    persistedKeys,
    pickerImportedName,
    permissionDeniedMessage,
    recentStoreErrorMessages,
    savedHandles,
    versionSummary: version.summary,
  };

  function seedFile(path: string, value: string) {
    window.localStorage.setItem(`localstudio.e2e.opfs.file:${path}`, value);
  }
}
