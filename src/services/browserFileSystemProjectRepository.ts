import type { ProjectDocument } from '../domain/model';
import type { ProjectRepository } from './interfaces';

interface FileSystemProjectRepositoryOptions {
  pickDirectory?: () => Promise<FileSystemDirectoryHandle>;
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

  constructor(private readonly options: FileSystemProjectRepositoryOptions = {}) {}

  async importProject(): Promise<ProjectDocument | null> {
    const pickDirectory = this.options.pickDirectory ?? getBrowserDirectoryPicker();
    this.directoryHandle = await pickDirectory();
    return this.loadProject();
  }

  async loadProject(): Promise<ProjectDocument | null> {
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

function getBrowserDirectoryPicker() {
  const browserWindow = typeof window === 'undefined' ? undefined : (window as WindowWithDirectoryPicker);
  if (!browserWindow?.showDirectoryPicker) {
    throw new Error('The File System Access API is not available in this browser.');
  }
  return () => browserWindow.showDirectoryPicker!({ mode: 'readwrite' });
}
