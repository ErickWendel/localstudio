import { createSampleProject } from '../../../src/domain/sampleProject';
import {
  BrowserFileSystemProjectRepository,
  type RecentProjectHandleStore,
} from '../../../src/services/browserFileSystemProjectRepository';

class MockWritable {
  constructor(private readonly onClose: (value: string) => void) {}

  private value = '';

  write(value: string): Promise<void> {
    this.value = value;
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.onClose(this.value);
    return Promise.resolve();
  }
}

class MockFileHandle {
  constructor(
    private readonly name: string,
    private readonly files: Map<string, string>,
  ) {}

  createWritable(): Promise<MockWritable> {
    return Promise.resolve(
      new MockWritable((value) => {
        this.files.set(this.name, value);
      }),
    );
  }

  getFile(): Promise<{ text: () => Promise<string> }> {
    const value = this.files.get(this.name);
    if (value === undefined) return Promise.reject(new DOMException('Not found', 'NotFoundError'));
    return Promise.resolve({ text: () => Promise.resolve(value) });
  }
}

class MockDirectoryHandle {
  readonly files = new Map<string, string>();
  readonly directories = new Map<string, MockDirectoryHandle>();

  getFileHandle(name: string, options?: { create?: boolean }): Promise<MockFileHandle> {
    if (!options?.create && !this.files.has(name)) {
      throw new DOMException('Not found', 'NotFoundError');
    }
    return Promise.resolve(new MockFileHandle(name, this.files));
  }

  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<MockDirectoryHandle> {
    if (!this.directories.has(name)) {
      if (!options?.create) throw new DOMException('Not found', 'NotFoundError');
      this.directories.set(name, new MockDirectoryHandle());
    }
    return Promise.resolve(this.directories.get(name)!);
  }

  queryPermission(): Promise<PermissionState> {
    return Promise.resolve('granted');
  }

  requestPermission(): Promise<PermissionState> {
    return Promise.resolve('granted');
  }
}

class MemoryRecentProjectHandleStore implements RecentProjectHandleStore {
  handle: FileSystemDirectoryHandle | null = null;
  handles = new Map<string, FileSystemDirectoryHandle>();

  load(projectName?: string): Promise<FileSystemDirectoryHandle | null> {
    if (projectName) return Promise.resolve(this.handles.get(projectName) ?? null);
    return Promise.resolve(this.handle);
  }

  save(handle: FileSystemDirectoryHandle, projectName?: string): Promise<void> {
    this.handle = handle;
    if (projectName) this.handles.set(projectName, handle);
    return Promise.resolve();
  }
}

describe('BrowserFileSystemProjectRepository', () => {
  it('creates the project folder structure and writes project metadata', async () => {
    const directory = new MockDirectoryHandle();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = createSampleProject();

    await repository.saveProject(project);

    expect(directory.directories.has('assets')).toBe(true);
    expect(directory.directories.has('cache')).toBe(true);
    expect(directory.directories.has('config')).toBe(true);
    expect(JSON.parse(directory.files.get('project.json')!)).toMatchObject({
      id: project.id,
      name: project.name,
    });
    expect(JSON.parse(directory.directories.get('config')!.files.get('localstudio.json')!)).toMatchObject({
      app: 'LocalStudio.ai',
      projectId: project.id,
    });
  });

  it('loads project.json from the selected folder after saving', async () => {
    const directory = new MockDirectoryHandle();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = createSampleProject();

    await repository.saveProject(project);
    const loaded = await repository.loadProject();

    expect(loaded?.id).toBe(project.id);
    expect(loaded?.pages).toHaveLength(1);
  });

  it('imports an existing project folder without overwriting it first', async () => {
    const directory = new MockDirectoryHandle();
    const project = createSampleProject();
    directory.files.set('project.json', JSON.stringify({ ...project, name: 'Imported Project' }));
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    const importedProject = await repository.importProject();

    expect(importedProject?.name).toBe('Imported Project');
    expect(directory.directories.size).toBe(0);
  });

  it('reopens the last project folder from the recent handle store', async () => {
    const directory = new MockDirectoryHandle();
    const recentProjectStore = new MemoryRecentProjectHandleStore();
    const project = createSampleProject();
    const firstRepository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore,
    });

    await firstRepository.saveProject(project);
    const secondRepository = new BrowserFileSystemProjectRepository({ recentProjectStore });

    const loaded = await secondRepository.loadProject();

    expect(loaded?.id).toBe(project.id);
    expect(loaded?.name).toBe(project.name);
  });

  it('reopens a project folder by project name instead of the global recent folder', async () => {
    const alphaDirectory = new MockDirectoryHandle();
    const betaDirectory = new MockDirectoryHandle();
    const recentProjectStore = new MemoryRecentProjectHandleStore();
    const alphaProject = { ...createSampleProject(), id: 'alpha', name: 'Alpha Deck' };
    const betaProject = { ...createSampleProject(), id: 'beta', name: 'Beta Deck' };

    await new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(alphaDirectory as unknown as FileSystemDirectoryHandle),
      recentProjectStore,
    }).saveProject(alphaProject);
    await new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(betaDirectory as unknown as FileSystemDirectoryHandle),
      recentProjectStore,
    }).saveProject(betaProject);

    const loaded = await new BrowserFileSystemProjectRepository({ recentProjectStore }).loadProject({
      projectName: 'Alpha Deck',
    });

    expect(loaded?.id).toBe('alpha');
    expect(loaded?.name).toBe('Alpha Deck');
  });
});
