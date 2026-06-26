import type { Asset, ProjectDocument } from '../domain/model';
import type {
  ProjectRepository,
  VersionHistoryEntry,
  VersionHistoryManifest,
  VersionSnapshotMetadata,
} from './interfaces';

interface FileSystemProjectRepositoryOptions {
  pickDirectory?: () => Promise<FileSystemDirectoryHandle>;
  recentProjectStore?: RecentProjectHandleStore;
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
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  };

const PROJECT_FILE_NAME = 'project.json';
const PROJECT_CONFIG_FILE_NAME = 'localstudio.json';
const VERSION_HISTORY_FILE_NAME = 'manifest.json';
const VERSION_HISTORY_LIMIT = 100;

function getAssetFileExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

function isDataUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('data:'));
}

function isBlobUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('blob:'));
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64 = ''] = dataUrl.split(',');
  const mimeType = metadata?.match(/^data:(.*?);base64$/)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

async function objectUrlToBlob(objectUrl: string) {
  if (isDataUrl(objectUrl)) return dataUrlToBlob(objectUrl);
  const response = await fetch(objectUrl);
  return response.blob();
}

function collectReferencedAssetIds(project: ProjectDocument) {
  const referencedAssetIds = new Set<string>();
  for (const element of Object.values(project.elements)) {
    if (element.type === 'image') referencedAssetIds.add(element.assetId);
  }
  for (const page of project.pages) {
    if (page.background.type === 'asset') referencedAssetIds.add(page.background.assetId);
  }
  return referencedAssetIds;
}

function getReferencedAssets(project: ProjectDocument) {
  const referencedAssetIds = collectReferencedAssetIds(project);
  return Object.fromEntries(
    Object.entries(project.assets).filter(([assetId]) => referencedAssetIds.has(assetId)),
  );
}

function createVersionId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function cloneProjectForHistory(project: ProjectDocument): ProjectDocument {
  return {
    ...project,
    assets: Object.fromEntries(
      Object.entries(project.assets).map(([assetId, asset]) => {
        const assetForDisk = { ...asset };
        delete assetForDisk.objectUrl;
        return [assetId, assetForDisk];
      }),
    ),
  };
}

async function createFileBackedProjectSnapshot(
  project: ProjectDocument,
  assetsDirectory: FileSystemDirectoryHandle,
): Promise<ProjectDocument> {
  const referencedAssets = getReferencedAssets(project);
  const projectForDisk: ProjectDocument = {
    ...project,
    assets: { ...referencedAssets },
  };

  for (const [assetId, asset] of Object.entries(referencedAssets)) {
    if (asset.storage === 'file' && asset.fileName) {
      const assetForDisk = { ...asset };
      delete assetForDisk.objectUrl;
      projectForDisk.assets[assetId] = assetForDisk;
      continue;
    }

    if (!isDataUrl(asset.objectUrl) && !isBlobUrl(asset.objectUrl)) continue;
    const fileName = asset.fileName ?? `${assetId}.${getAssetFileExtension(asset.mimeType)}`;
    await writeBlobFileToDirectory(assetsDirectory, fileName, await objectUrlToBlob(asset.objectUrl));
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

function getChangedElementKeys(previousProject: ProjectDocument, nextProject: ProjectDocument) {
  const changedElementIds = new Set<string>();
  const elementIds = new Set([...Object.keys(previousProject.elements), ...Object.keys(nextProject.elements)]);
  for (const elementId of elementIds) {
    if (JSON.stringify(previousProject.elements[elementId]) !== JSON.stringify(nextProject.elements[elementId])) {
      changedElementIds.add(elementId);
    }
  }
  return changedElementIds;
}

function createChangeSummary(project: ProjectDocument, previousProject?: ProjectDocument) {
  if (!previousProject) {
    const firstPage = project.pages[0];
    return {
      changeCount: 1,
      summary: 'Initial saved version',
      ...(firstPage ? { firstChangedPageId: firstPage.id } : {}),
    };
  }

  let changeCount = 0;
  let firstChangedPageId: string | undefined;
  let firstChangedElementId: string | undefined;
  const changedElementIds = getChangedElementKeys(previousProject, project);

  for (const elementId of changedElementIds) {
    changeCount += 1;
    const page =
      project.pages.find((item) => item.elementIds.includes(elementId)) ??
      previousProject.pages.find((item) => item.elementIds.includes(elementId));
    firstChangedPageId ??= page?.id;
    firstChangedElementId ??= elementId;
  }

  const pageIds = new Set([...previousProject.pages.map((page) => page.id), ...project.pages.map((page) => page.id)]);
  for (const pageId of pageIds) {
    const previousPage = previousProject.pages.find((page) => page.id === pageId);
    const nextPage = project.pages.find((page) => page.id === pageId);
    if (JSON.stringify(previousPage) !== JSON.stringify(nextPage)) {
      changeCount += 1;
      firstChangedPageId ??= nextPage?.id ?? previousPage?.id;
      const pageElementIds = [...(nextPage?.elementIds ?? []), ...(previousPage?.elementIds ?? [])];
      firstChangedElementId ??= pageElementIds.find((elementId) => changedElementIds.has(elementId));
    }
  }

  for (const assetId of new Set([...Object.keys(previousProject.assets), ...Object.keys(project.assets)])) {
    if (JSON.stringify(previousProject.assets[assetId]) !== JSON.stringify(project.assets[assetId])) {
      changeCount += 1;
    }
  }

  if (project.name !== previousProject.name) changeCount += 1;
  if (changeCount === 0) {
    return {
      changeCount: 0,
      summary: 'No visible changes',
      ...(project.pages[0] ? { firstChangedPageId: project.pages[0].id } : {}),
    };
  }

  return {
    changeCount,
    summary: `${changeCount} ${changeCount === 1 ? 'edit' : 'edits'}`,
    ...(firstChangedPageId ? { firstChangedPageId } : {}),
    ...(firstChangedElementId ? { firstChangedElementId } : {}),
  };
}

export class BrowserFileSystemProjectRepository implements ProjectRepository {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
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

  async loadProject(options?: { projectName?: string }): Promise<ProjectDocument | null> {
    if (!this.directoryHandle) {
      this.directoryHandle = await this.recentProjectStore.load(options?.projectName);
    }
    if (!this.directoryHandle) return null;
    await this.ensureReadWritePermission(this.directoryHandle);

    let file: File;
    try {
      const fileHandle = await this.directoryHandle.getFileHandle(PROJECT_FILE_NAME);
      file = await fileHandle.getFile();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return null;
      throw error;
    }

    const project = JSON.parse(await file.text()) as ProjectDocument;
    return this.hydrateProjectAssets(project);
  }

  async saveProject(project: ProjectDocument): Promise<void> {
    const directoryHandle = await this.ensureProjectDirectory(project.name);
    const assetsDirectory = await directoryHandle.getDirectoryHandle('assets', { create: true });
    await Promise.all([
      directoryHandle.getDirectoryHandle('cache', { create: true }),
      directoryHandle.getDirectoryHandle('config', { create: true }),
    ]);

    const staleAssets = Object.entries(project.assets)
      .filter(([assetId]) => !collectReferencedAssetIds(project).has(assetId))
      .map(([, asset]) => asset);

    const projectForDisk = await createFileBackedProjectSnapshot(project, assetsDirectory);

    await this.removeStaleAssetFiles(assetsDirectory, staleAssets);
    await this.writeJsonFile(directoryHandle, PROJECT_FILE_NAME, projectForDisk);
    const configDirectory = await directoryHandle.getDirectoryHandle('config', { create: true });
    await this.writeJsonFile(configDirectory, PROJECT_CONFIG_FILE_NAME, {
      app: 'LocalStudio.ai',
      projectId: project.id,
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
    });
  }

  async getVersionHistory(): Promise<VersionHistoryEntry[]> {
    const directoryHandle = await this.ensureProjectDirectory();
    const manifest = await this.readVersionHistoryManifest(directoryHandle);
    return manifest.versions;
  }

  async saveVersion(project: ProjectDocument, metadata: VersionSnapshotMetadata): Promise<VersionHistoryEntry> {
    const directoryHandle = await this.ensureProjectDirectory(project.name);
    const assetsDirectory = await directoryHandle.getDirectoryHandle('assets', { create: true });
    const historyDirectory = await directoryHandle.getDirectoryHandle('history', { create: true });
    const versionsDirectory = await historyDirectory.getDirectoryHandle('versions', { create: true });
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
      ...(changeSummary.firstChangedPageId ? { firstChangedPageId: changeSummary.firstChangedPageId } : {}),
      ...(changeSummary.firstChangedElementId ? { firstChangedElementId: changeSummary.firstChangedElementId } : {}),
    };

    const projectForHistory = await createFileBackedProjectSnapshot(project, assetsDirectory);
    await this.writeJsonFile(versionsDirectory, fileName, cloneProjectForHistory(projectForHistory));
    const nextVersions = [entry, ...manifest.versions.filter((version) => version.id !== entry.id)];
    const retainedVersions = nextVersions.slice(0, VERSION_HISTORY_LIMIT);
    await this.removePrunedVersionFiles(versionsDirectory, nextVersions.slice(VERSION_HISTORY_LIMIT));
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
    const historyDirectory = await directoryHandle.getDirectoryHandle('history');
    const versionsDirectory = await historyDirectory.getDirectoryHandle('versions');
    const fileHandle = await versionsDirectory.getFileHandle(entry.fileName);
    const file = await fileHandle.getFile();
    return this.hydrateProjectAssets(JSON.parse(await file.text()) as ProjectDocument);
  }

  private async ensureProjectDirectory(projectName?: string): Promise<FileSystemDirectoryHandle> {
    if (!this.directoryHandle) {
      const pickDirectory = this.options.pickDirectory ?? getBrowserDirectoryPicker();
      this.directoryHandle = await pickDirectory();
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
    throw new Error('LocalStudio.ai needs permission to read and write the selected project folder.');
  }

  private async writeJsonFile(directoryHandle: FileSystemDirectoryHandle, fileName: string, value: unknown) {
    const temporaryFileName = `${fileName}.tmp`;
    await this.writeTextFile(directoryHandle, temporaryFileName, JSON.stringify(value, null, 2));
    await this.writeTextFile(directoryHandle, fileName, JSON.stringify(value, null, 2));
    if (directoryHandle.removeEntry) {
      await directoryHandle.removeEntry(temporaryFileName).catch(() => undefined);
    }
  }

  private async writeTextFile(directoryHandle: FileSystemDirectoryHandle, fileName: string, value: string) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(value);
    await writable.close();
  }

  private async removeStaleAssetFiles(directoryHandle: FileSystemDirectoryHandle, staleAssets: Asset[]) {
    await Promise.all(
      staleAssets.map(async (asset) => {
        if (asset.storage !== 'file' || !asset.fileName || !directoryHandle.removeEntry) return;
        await directoryHandle.removeEntry(asset.fileName).catch(() => undefined);
      }),
    );
  }

  private async removePrunedVersionFiles(directoryHandle: FileSystemDirectoryHandle, entries: VersionHistoryEntry[]) {
    if (!directoryHandle.removeEntry) return;
    await Promise.all(entries.map((entry) => directoryHandle.removeEntry(entry.fileName).catch(() => undefined)));
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
      if (error instanceof DOMException && error.name !== 'NotFoundError') throw error;
      return { schemaVersion: 1, projectId, versions: [] };
    }
  }

  private async hydrateProjectAssets(project: ProjectDocument): Promise<ProjectDocument> {
    if (!this.directoryHandle) return project;
    const assets: ProjectDocument['assets'] = {};
    let assetsDirectory: FileSystemDirectoryHandle | undefined;

    for (const [assetId, asset] of Object.entries(project.assets)) {
      if (asset.storage !== 'file' || !asset.fileName) {
        assets[assetId] = asset;
        continue;
      }
      assetsDirectory ??= await this.directoryHandle.getDirectoryHandle('assets');
      const fileHandle = await assetsDirectory.getFileHandle(asset.fileName);
      const file = await fileHandle.getFile();
      assets[assetId] = {
        ...asset,
        objectUrl: URL.createObjectURL(file),
      };
    }

    return { ...project, assets };
  }
}

class BrowserRecentProjectHandleStore implements RecentProjectHandleStore {
  private readonly databaseName = 'localstudio-ai-recent-projects';
  private readonly objectStoreName = 'handles';
  private readonly handleKey = 'last-project-directory';
  private readonly localStorageKey = 'localstudio.ai.last-project.available';

  async load(projectName?: string): Promise<FileSystemDirectoryHandle | null> {
    if (typeof window === 'undefined') return null;
    const database = await this.openDatabase();
    if (projectName) {
      return (await this.getValue<FileSystemDirectoryHandle>(database, this.getProjectHandleKey(projectName))) ?? null;
    }
    if (window.localStorage.getItem(this.localStorageKey) !== 'true') return null;
    return (await this.getValue<FileSystemDirectoryHandle>(database, this.handleKey)) ?? null;
  }

  async save(handle: FileSystemDirectoryHandle, projectName?: string): Promise<void> {
    if (typeof window === 'undefined') return;
    const database = await this.openDatabase();
    await this.putValue(database, this.handleKey, handle);
    if (projectName) {
      await this.putValue(database, this.getProjectHandleKey(projectName), handle);
    }
    window.localStorage.setItem(this.localStorageKey, 'true');
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
  const browserWindow = typeof window === 'undefined' ? undefined : (window as WindowWithDirectoryPicker);
  if (!browserWindow?.showDirectoryPicker) {
    throw new Error('The File System Access API is not available in this browser.');
  }
  return () => browserWindow.showDirectoryPicker!({ mode: 'readwrite' });
}
