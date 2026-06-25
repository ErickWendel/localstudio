import { createSampleProject } from '../../../src/domain/sampleProject';
import { BrowserFileSystemProjectRepository } from '../../../src/services/browserFileSystemProjectRepository';

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

describe('BrowserFileSystemProjectRepository', () => {
  it('creates the project folder structure and writes project metadata', async () => {
    const directory = new MockDirectoryHandle();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
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
    });

    const importedProject = await repository.importProject();

    expect(importedProject?.name).toBe('Imported Project');
    expect(directory.directories.size).toBe(0);
  });
});
