import type { ProjectDocument } from '../domain/model';
import type { ProjectRepository } from './interfaces';

interface FileSystemProjectRepositoryOptions {
  pickDirectory?: () => Promise<FileSystemDirectoryHandle>;
  recentProjectStore?: RecentProjectHandleStore;
}

export interface RecentProjectHandleStore {
  load(): Promise<FileSystemDirectoryHandle | null>;
  save(handle: FileSystemDirectoryHandle): Promise<void>;
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
    return this.loadProject();
  }

  async loadProject(): Promise<ProjectDocument | null> {
    if (!this.directoryHandle) {
      this.directoryHandle = await this.recentProjectStore.load();
    }
    if (!this.directoryHandle) return null;
    await this.ensureReadWritePermission(this.directoryHandle);

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(PROJECT_FILE_NAME);
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text()) as ProjectDocument;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return null;
      throw error;
    }
  }

  async saveProject(project: ProjectDocument): Promise<void> {
    const directoryHandle = await this.ensureProjectDirectory();
    await Promise.all([
      directoryHandle.getDirectoryHandle('assets', { create: true }),
      directoryHandle.getDirectoryHandle('cache', { create: true }),
      directoryHandle.getDirectoryHandle('config', { create: true }),
    ]);

    await this.writeJsonFile(directoryHandle, PROJECT_FILE_NAME, project);
    const configDirectory = await directoryHandle.getDirectoryHandle('config', { create: true });
    await this.writeJsonFile(configDirectory, PROJECT_CONFIG_FILE_NAME, {
      app: 'LocalStudio.ai',
      projectId: project.id,
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
    });
  }

  private async ensureProjectDirectory(): Promise<FileSystemDirectoryHandle> {
    if (!this.directoryHandle) {
      const pickDirectory = this.options.pickDirectory ?? getBrowserDirectoryPicker();
      this.directoryHandle = await pickDirectory();
      await this.recentProjectStore.save(this.directoryHandle);
    }
    const directoryHandle = this.directoryHandle;
    await this.ensureReadWritePermission(directoryHandle);
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
}

class BrowserRecentProjectHandleStore implements RecentProjectHandleStore {
  private readonly databaseName = 'localstudio-ai-recent-projects';
  private readonly objectStoreName = 'handles';
  private readonly handleKey = 'last-project-directory';
  private readonly localStorageKey = 'localstudio.ai.last-project.available';

  async load(): Promise<FileSystemDirectoryHandle | null> {
    if (typeof window === 'undefined') return null;
    if (window.localStorage.getItem(this.localStorageKey) !== 'true') return null;
    const database = await this.openDatabase();
    return (await this.getValue<FileSystemDirectoryHandle>(database, this.handleKey)) ?? null;
  }

  async save(handle: FileSystemDirectoryHandle): Promise<void> {
    if (typeof window === 'undefined') return;
    const database = await this.openDatabase();
    await this.putValue(database, this.handleKey, handle);
    window.localStorage.setItem(this.localStorageKey, 'true');
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
