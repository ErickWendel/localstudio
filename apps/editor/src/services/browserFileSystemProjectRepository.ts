import type { ProjectDocument } from '../domain/model';
import type {
  MirrorFile,
  ProjectRepository,
  VersionHistoryEntry,
  VersionHistoryManifest,
  VersionSnapshotMetadata,
} from './interfaces';
import { getBrowserLocalStorage, type BrowserKeyValueStorage } from './browserStorage';
import {
  getAssetFileExtension,
  isReadableObjectUrl,
  objectUrlToBlob,
} from './assetFileUtils';
import {
  cloneProjectForHistory,
  createChangeSummary,
  createVersionId,
} from './projectVersionHistoryUtils';

interface FileSystemProjectRepositoryOptions {
  pickDirectory?: () => Promise<FileSystemDirectoryHandle>;
  recentProjectStore?: RecentProjectHandleStore;
}

interface HydrateProjectAssetsOptions {
  allowMissingAssetFiles?: boolean;
}

export interface RecentProjectHandleStore {
  load(projectName?: string): Promise<FileSystemDirectoryHandle | null>;
  save(handle: FileSystemDirectoryHandle, projectName?: string): Promise<void>;
}

type PermissionCapableDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

type WindowWithDirectoryPicker = Window &
  typeof globalThis & {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandle>;
  };

const PROJECT_FILE_NAME = 'project.json';
const PROJECT_CONFIG_FILE_NAME = 'localstudio.json';
const VERSION_HISTORY_FILE_NAME = 'manifest.json';
const VERSION_HISTORY_LIMIT = 100;

async function createFileBackedProjectSnapshot(
  project: ProjectDocument,
  assetsDirectory: FileSystemDirectoryHandle,
): Promise<ProjectDocument> {
  const projectAssets = project.assets;
  const projectForDisk: ProjectDocument = {
    ...project,
    assets: { ...projectAssets },
  };

  for (const [assetId, asset] of Object.entries(projectAssets)) {
    if (asset.storage === 'file' && asset.fileName) {
      const assetForDisk = { ...asset };
      delete assetForDisk.objectUrl;
      projectForDisk.assets[assetId] = assetForDisk;
      continue;
    }

    if (!isReadableObjectUrl(asset.objectUrl)) continue;
    const fileName = asset.fileName ?? `${assetId}.${getAssetFileExtension(asset.mimeType)}`;
    await writeBlobFileToDirectory(
      assetsDirectory,
      fileName,
      await objectUrlToBlob(asset.objectUrl),
    );
    const assetForDisk = { ...asset };
    delete assetForDisk.objectUrl;
    projectForDisk.assets[assetId] = {
      ...assetForDisk,
      fileName,
      storage: 'file',
    };
  }

  return projectForDisk;
}

async function writeBlobFileToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  fileName: string,
  value: Blob,
) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(value);
  await writable.close();
}

async function readProjectNameFromMirrorFiles(files: MirrorFile[]) {
  const projectFile = files.find((file) => file.path === PROJECT_FILE_NAME);
  if (!projectFile) return undefined;
  const project = JSON.parse(await projectFile.blob.text()) as ProjectDocument;
  return project.name.trim() || undefined;
}

function isNotFoundError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

export class BrowserFileSystemProjectRepository implements ProjectRepository {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private parentDirectoryHandle: FileSystemDirectoryHandle | null = null;
  private projectDirectoryName: string | null = null;
  private readonly recentProjectStore: RecentProjectHandleStore;

  constructor(private readonly options: FileSystemProjectRepositoryOptions = {}) {
    this.recentProjectStore = options.recentProjectStore ?? new BrowserRecentProjectHandleStore();
  }

  async importProject(): Promise<ProjectDocument | null> {
    const pickDirectory = this.options.pickDirectory ?? getBrowserDirectoryPicker();
    this.directoryHandle = await pickDirectory();
    await this.recentProjectStore.save(this.directoryHandle);
    const project = await this.loadProject();
    if (project) await this.recentProjectStore.save(this.directoryHandle, project.name);
    return project;
  }

  async importMirrorFiles(files: MirrorFile): Promise<ProjectDocument>;
  async importMirrorFiles(files: MirrorFile[]): Promise<ProjectDocument>;
  async importMirrorFiles(files: MirrorFile | MirrorFile[]): Promise<ProjectDocument> {
    const pickDirectory = this.options.pickDirectory ?? getBrowserDirectoryPicker();
    const selectedDirectoryHandle = await pickDirectory();
    const mirrorFiles = Array.isArray(files) ? files : [files];
    const projectDirectoryName = await readProjectNameFromMirrorFiles(mirrorFiles);
    this.parentDirectoryHandle = projectDirectoryName ? selectedDirectoryHandle : null;
    this.projectDirectoryName = projectDirectoryName ?? selectedDirectoryHandle.name ?? null;
    this.directoryHandle = projectDirectoryName
      ? await selectedDirectoryHandle.getDirectoryHandle(projectDirectoryName, { create: true })
      : selectedDirectoryHandle;
    await this.ensureReadWritePermission(this.directoryHandle);
    for (const file of mirrorFiles) {
      await this.writeMirrorFile(this.directoryHandle, file);
    }
    const project = await this.readProjectFromDirectory(this.directoryHandle, {
      allowMissingAssetFiles: true,
    });
    if (!project) throw new Error('The mirrored project did not include project.json.');
    await this.recentProjectStore.save(this.directoryHandle, project.name);
    return project;
  }

  async loadProject(options?: { projectName?: string }): Promise<ProjectDocument | null> {
    if (!this.directoryHandle) {
      this.directoryHandle = await this.recentProjectStore.load(options?.projectName);
    }
    if (!this.directoryHandle) return null;
    await this.ensureReadWritePermission(this.directoryHandle);

    return this.readProjectFromDirectory(this.directoryHandle);
  }

  private async readProjectFromDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    options: HydrateProjectAssetsOptions = {},
  ): Promise<ProjectDocument | null> {
    let file: File;
    try {
      const fileHandle = await directoryHandle.getFileHandle(PROJECT_FILE_NAME);
      file = await fileHandle.getFile();
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }

    const project = JSON.parse(await file.text()) as ProjectDocument;
    return this.hydrateProjectAssets(project, options);
  }

  async saveProject(
    project: ProjectDocument,
    options?: { projectDirectoryName?: string },
  ): Promise<void> {
    const previousProjectDirectoryName = this.projectDirectoryName;
    const directoryHandle = await this.ensureProjectDirectory(project.name, options);
    const assetsDirectory = await directoryHandle.getDirectoryHandle('assets', { create: true });
    await Promise.all([
      directoryHandle.getDirectoryHandle('cache', { create: true }),
      directoryHandle.getDirectoryHandle('config', { create: true }),
    ]);

    const projectForDisk = await createFileBackedProjectSnapshot(project, assetsDirectory);
    const retainedAssetFileNames = new Set(
      Object.values(projectForDisk.assets)
        .map((asset) => asset.fileName)
        .filter((fileName): fileName is string => Boolean(fileName)),
    );

    await this.removeUnretainedAssetFiles(assetsDirectory, retainedAssetFileNames);
    await this.writeJsonFile(directoryHandle, PROJECT_FILE_NAME, projectForDisk);
    const configDirectory = await directoryHandle.getDirectoryHandle('config', { create: true });
    await this.writeJsonFile(configDirectory, PROJECT_CONFIG_FILE_NAME, {
      app: 'LocalStudio.dev',
      projectId: project.id,
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
    });
    if (
      previousProjectDirectoryName &&
      previousProjectDirectoryName !== this.projectDirectoryName &&
      this.parentDirectoryHandle?.removeEntry
    ) {
      await this.parentDirectoryHandle
        .removeEntry(previousProjectDirectoryName, { recursive: true })
        .catch(() => undefined);
    }
  }

  async getVersionHistory(): Promise<VersionHistoryEntry[]> {
    const directoryHandle = await this.ensureProjectDirectory();
    const manifest = await this.readVersionHistoryManifest(directoryHandle);
    return manifest.versions;
  }

  async saveVersion(
    project: ProjectDocument,
    metadata: VersionSnapshotMetadata,
  ): Promise<VersionHistoryEntry> {
    const directoryHandle = await this.ensureProjectDirectory(project.name);
    const assetsDirectory = await directoryHandle.getDirectoryHandle('assets', { create: true });
    const historyDirectory = await directoryHandle.getDirectoryHandle('history', { create: true });
    const versionsDirectory = await historyDirectory.getDirectoryHandle('versions', {
      create: true,
    });
    const manifest = await this.readVersionHistoryManifest(directoryHandle, project.id);
    const createdAt = new Date().toISOString();
    const id = createVersionId(new Date(createdAt));
    const fileName = `${id}.json`;
    const changeSummary = createChangeSummary(project, metadata.previousProject);
    const entry: VersionHistoryEntry = {
      id,
      createdAt,
      authorName: 'Local user',
      projectName: project.name,
      summary: changeSummary.summary,
      changeCount: changeSummary.changeCount,
      fileName,
      ...(changeSummary.firstChangedPageId
        ? { firstChangedPageId: changeSummary.firstChangedPageId }
        : {}),
      ...(changeSummary.firstChangedElementId
        ? { firstChangedElementId: changeSummary.firstChangedElementId }
        : {}),
    };

    const projectForHistory = await createFileBackedProjectSnapshot(project, assetsDirectory);
    await this.writeJsonFile(
      versionsDirectory,
      fileName,
      cloneProjectForHistory(projectForHistory),
    );
    const nextVersions = [entry, ...manifest.versions.filter((version) => version.id !== entry.id)];
    const retainedVersions = nextVersions.slice(0, VERSION_HISTORY_LIMIT);
    await this.removePrunedVersionFiles(
      versionsDirectory,
      nextVersions.slice(VERSION_HISTORY_LIMIT),
    );
    await this.writeJsonFile(historyDirectory, VERSION_HISTORY_FILE_NAME, {
      schemaVersion: 1,
      projectId: project.id,
      latestVersionId: entry.id,
      versions: retainedVersions,
    } satisfies VersionHistoryManifest);
    return entry;
  }

  async loadVersion(versionId: string): Promise<ProjectDocument | null> {
    const directoryHandle = await this.ensureProjectDirectory();
    const manifest = await this.readVersionHistoryManifest(directoryHandle);
    const entry = manifest.versions.find((version) => version.id === versionId);
    if (!entry) return null;
    try {
      const historyDirectory = await directoryHandle.getDirectoryHandle('history');
      const versionsDirectory = await historyDirectory.getDirectoryHandle('versions');
      const fileHandle = await versionsDirectory.getFileHandle(entry.fileName);
      const file = await fileHandle.getFile();
      return this.hydrateProjectAssets(JSON.parse(await file.text()) as ProjectDocument, {
        allowMissingAssetFiles: true,
      });
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  private async ensureProjectDirectory(
    projectName?: string,
    options?: { projectDirectoryName?: string },
  ): Promise<FileSystemDirectoryHandle> {
    const requestedProjectDirectoryName =
      options?.projectDirectoryName?.trim() ||
      (this.parentDirectoryHandle && projectName?.trim() ? projectName.trim() : undefined);

    if (!this.directoryHandle) {
      const pickDirectory = this.options.pickDirectory ?? getBrowserDirectoryPicker();
      const selectedDirectoryHandle = await pickDirectory();
      this.parentDirectoryHandle = requestedProjectDirectoryName ? selectedDirectoryHandle : null;
      this.projectDirectoryName = requestedProjectDirectoryName ?? selectedDirectoryHandle.name ?? null;
      this.directoryHandle = requestedProjectDirectoryName
        ? await selectedDirectoryHandle.getDirectoryHandle(requestedProjectDirectoryName, {
            create: true,
          })
        : selectedDirectoryHandle;
    } else if (
      requestedProjectDirectoryName &&
      this.parentDirectoryHandle &&
      requestedProjectDirectoryName !== this.projectDirectoryName
    ) {
      this.directoryHandle = await this.parentDirectoryHandle.getDirectoryHandle(
        requestedProjectDirectoryName,
        { create: true },
      );
      this.projectDirectoryName = requestedProjectDirectoryName;
    }
    const directoryHandle = this.directoryHandle;
    await this.ensureReadWritePermission(directoryHandle);
    await this.recentProjectStore.save(directoryHandle, projectName);
    return directoryHandle;
  }

  private async ensureReadWritePermission(directoryHandle: FileSystemDirectoryHandle) {
    const permissions = { mode: 'readwrite' as const };
    const permissionCapableHandle = directoryHandle as PermissionCapableDirectoryHandle;
    if (permissionCapableHandle.queryPermission) {
      const currentPermission = await permissionCapableHandle.queryPermission(permissions);
      if (currentPermission === 'granted') return;
    }
    if (permissionCapableHandle.requestPermission) {
      const nextPermission = await permissionCapableHandle.requestPermission(permissions);
      if (nextPermission === 'granted') return;
    }
    throw new Error(
      'LocalStudio.dev needs permission to read and write the selected project folder.',
    );
  }

  private async writeJsonFile(
    directoryHandle: FileSystemDirectoryHandle,
    fileName: string,
    value: unknown,
  ) {
    const temporaryFileName = `${fileName}.tmp`;
    await this.writeTextFile(directoryHandle, temporaryFileName, JSON.stringify(value, null, 2));
    await this.writeTextFile(directoryHandle, fileName, JSON.stringify(value, null, 2));
    if (directoryHandle.removeEntry) {
      await directoryHandle.removeEntry(temporaryFileName).catch(() => undefined);
    }
  }

  private async writeTextFile(
    directoryHandle: FileSystemDirectoryHandle,
    fileName: string,
    value: string,
  ) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(value);
    await writable.close();
  }

  private async removeUnretainedAssetFiles(
    directoryHandle: FileSystemDirectoryHandle,
    retainedAssetFileNames: Set<string>,
  ) {
    if (!directoryHandle.removeEntry) return;
    const entries = (directoryHandle as unknown as {
      entries?: () => AsyncIterable<[string, { kind?: string }]>;
    }).entries;
    if (!entries) return;

    const removals: Array<Promise<void>> = [];
    for await (const [name, handle] of entries.call(directoryHandle)) {
      if (handle.kind !== 'file' || retainedAssetFileNames.has(name)) continue;
      removals.push(directoryHandle.removeEntry(name).catch(() => undefined));
    }
    await Promise.all(removals);
  }

  private async writeMirrorFile(directoryHandle: FileSystemDirectoryHandle, file: MirrorFile) {
    const pathParts = file.path.split('/').filter(Boolean);
    const fileName = pathParts.pop();
    if (!fileName) return;
    let currentDirectory = directoryHandle;
    for (const directoryName of pathParts) {
      currentDirectory = await currentDirectory.getDirectoryHandle(directoryName, { create: true });
    }
    await writeBlobFileToDirectory(currentDirectory, fileName, file.blob);
  }

  private async removePrunedVersionFiles(
    directoryHandle: FileSystemDirectoryHandle,
    entries: VersionHistoryEntry[],
  ) {
    if (!directoryHandle.removeEntry) return;
    await Promise.all(
      entries.map((entry) => directoryHandle.removeEntry(entry.fileName).catch(() => undefined)),
    );
  }

  private async readVersionHistoryManifest(
    directoryHandle: FileSystemDirectoryHandle,
    projectId = 'unknown-project',
  ): Promise<VersionHistoryManifest> {
    const historyDirectory = await directoryHandle.getDirectoryHandle('history', { create: true });
    try {
      const fileHandle = await historyDirectory.getFileHandle(VERSION_HISTORY_FILE_NAME);
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text()) as VersionHistoryManifest;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      return { schemaVersion: 1, projectId, versions: [] };
    }
  }

  private async hydrateProjectAssets(
    project: ProjectDocument,
    options: HydrateProjectAssetsOptions = {},
  ): Promise<ProjectDocument> {
    if (!this.directoryHandle) return project;
    const assets: ProjectDocument['assets'] = {};
    let assetsDirectory: FileSystemDirectoryHandle | undefined;

    for (const [assetId, asset] of Object.entries(project.assets)) {
      if (asset.storage !== 'file' || !asset.fileName) {
        assets[assetId] = asset;
        continue;
      }
      try {
        assetsDirectory ??= await this.directoryHandle.getDirectoryHandle('assets');
        const fileHandle = await assetsDirectory.getFileHandle(asset.fileName);
        const file = await fileHandle.getFile();
        assets[assetId] = {
          ...asset,
          objectUrl: URL.createObjectURL(file),
        };
      } catch (error) {
        if (!isNotFoundError(error) || !options.allowMissingAssetFiles) throw error;
        assets[assetId] = asset;
      }
    }

    return { ...project, assets };
  }
}

class BrowserRecentProjectHandleStore implements RecentProjectHandleStore {
  private readonly databaseName = 'localstudio-ai-recent-projects';
  private readonly objectStoreName = 'handles';
  private readonly handleKey = 'last-project-directory';
  private readonly localStorageKey = 'localstudio.ai.last-project.available';

  constructor(private readonly storage: BrowserKeyValueStorage | undefined = getBrowserLocalStorage()) {}

  async load(projectName?: string): Promise<FileSystemDirectoryHandle | null> {
    if (typeof window === 'undefined') return null;
    const database = await this.openDatabase();
    if (projectName) {
      return (
        (await this.getValue<FileSystemDirectoryHandle>(
          database,
          this.getProjectHandleKey(projectName),
        )) ?? null
      );
    }
    if (this.storage?.getItem(this.localStorageKey) !== 'true') return null;
    return (await this.getValue<FileSystemDirectoryHandle>(database, this.handleKey)) ?? null;
  }

  async save(handle: FileSystemDirectoryHandle, projectName?: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const database = await this.openDatabase();
    await this.putValue(database, this.handleKey, handle);
    if (projectName) {
      await this.putValue(database, this.getProjectHandleKey(projectName), handle);
    }
    this.storage?.setItem(this.localStorageKey, 'true');
  }

  private getProjectHandleKey(projectName: string) {
    return `project-directory:${projectName.trim().toLocaleLowerCase()}`;
  }

  private openDatabase() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.objectStoreName);
      };
      request.onerror = () => {
        reject(request.error ?? new Error('Could not open recent project storage.'));
      };
      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  private getValue<T>(database: IDBDatabase, key: string) {
    return new Promise<T | undefined>((resolve, reject) => {
      const transaction = database.transaction(this.objectStoreName, 'readonly');
      const request = transaction.objectStore(this.objectStoreName).get(key);
      request.onerror = () => {
        reject(request.error ?? new Error('Could not read recent project handle.'));
      };
      request.onsuccess = () => {
        resolve(request.result as T | undefined);
      };
    });
  }

  private putValue(database: IDBDatabase, key: string, value: unknown) {
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.objectStoreName, 'readwrite');
      const request = transaction.objectStore(this.objectStoreName).put(value, key);
      request.onerror = () => {
        reject(request.error ?? new Error('Could not save recent project handle.'));
      };
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        reject(transaction.error ?? new Error('Could not commit recent project handle.'));
      };
    });
  }
}

function getBrowserDirectoryPicker() {
  const browserWindow =
    typeof window === 'undefined' ? undefined : (window as WindowWithDirectoryPicker);
  if (!browserWindow?.showDirectoryPicker) {
    throw new Error('The File System Access API is not available in this browser.');
  }
  return () => browserWindow.showDirectoryPicker!({ mode: 'readwrite' });
}
