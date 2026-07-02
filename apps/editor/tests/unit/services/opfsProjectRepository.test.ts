import type { BrowserKeyValueStorage } from '../../../src/services/browser/browserStorage';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { OpfsProjectRepository } from '../../../src/services/storage/opfsProjectRepository';
import { vi } from 'vitest';

class MockWritable {
  constructor(private readonly onClose: (value: string | Blob) => void) {}

  private value: string | Blob = '';

  write(value: string | Blob): Promise<void> {
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
    private readonly files: Map<string, string | Blob>,
  ) {}

  createWritable(): Promise<MockWritable> {
    return Promise.resolve(
      new MockWritable((value) => {
        this.files.set(this.name, value);
      }),
    );
  }

  getFile(): Promise<{ text: () => Promise<string>; type: string }> {
    const value = this.files.get(this.name);
    if (value === undefined) return Promise.reject(new DOMException('Not found', 'NotFoundError'));
    if (typeof value === 'string') {
      return Promise.resolve({ text: () => Promise.resolve(value), type: 'application/json' });
    }
    return Promise.resolve(value);
  }
}

class MockDirectoryHandle {
  constructor(readonly name = 'root') {}

  readonly files = new Map<string, string | Blob>();
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
      this.directories.set(name, new MockDirectoryHandle(name));
    }
    return Promise.resolve(this.directories.get(name)!);
  }

  removeEntry(name: string): Promise<void> {
    this.files.delete(name);
    this.directories.delete(name);
    return Promise.resolve();
  }

  async *entries(): AsyncIterableIterator<[string, { kind: 'file' | 'directory'; name: string }]> {
    for (const name of this.files.keys()) yield [name, { kind: 'file', name }];
    for (const name of this.directories.keys()) yield [name, { kind: 'directory', name }];
  }
}

class MemoryStorage implements BrowserKeyValueStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

async function readMockText(value: string | Blob) {
  return typeof value === 'string' ? value : value.text();
}

async function getProjectDirectory(root: MockDirectoryHandle, projectName: string) {
  const projects = root.directories.get('projects');
  if (!projects) throw new Error('Missing projects directory.');
  const projectDirectory = projects.directories.get(encodeURIComponent(projectName));
  if (!projectDirectory) throw new Error(`Missing ${projectName} project directory.`);
  return projectDirectory;
}

describe('OpfsProjectRepository', () => {
  it('creates OPFS project structure and writes project metadata', async () => {
    const root = new MockDirectoryHandle();
    const storage = new MemoryStorage();
    const repository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage,
    });
    const project = sampleProject.createSampleProject();

    await repository.saveProject(project);

    const projectDirectory = await getProjectDirectory(root, project.name);
    expect(projectDirectory.directories.has('assets')).toBe(true);
    expect(projectDirectory.directories.has('cache')).toBe(true);
    expect(projectDirectory.directories.has('config')).toBe(true);
    expect(JSON.parse(await readMockText(projectDirectory.files.get('project.json')!))).toMatchObject({
      id: project.id,
      name: project.name,
    });
    expect(
      JSON.parse(
        await readMockText(
          projectDirectory.directories.get('config')!.files.get('localstudio.json')!,
        ),
      ),
    ).toMatchObject({ app: 'LocalStudio.dev', projectId: project.id, storage: 'opfs' });
    expect(storage.getItem('localstudio.ai.opfs.last-project-name')).toBe(project.name);
  });

  it('loads the remembered OPFS project and hydrates file-backed assets', async () => {
    const root = new MockDirectoryHandle();
    const storage = new MemoryStorage();
    const repository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage,
    });
    const project: ProjectDocument = {
      ...sampleProject.createSampleProject(),
      assets: {
        asset1: {
          id: 'asset1',
          type: 'image',
          name: 'hero.png',
          mimeType: 'image/png',
          fileName: 'hero.png',
          storage: 'file',
        },
      },
    };
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:hero');

    await repository.saveProject(project);
    const projectDirectory = await getProjectDirectory(root, project.name);
    projectDirectory.directories.get('assets')!.files.set('hero.png', new Blob(['image'], { type: 'image/png' }));

    const loaded = await new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage,
    }).loadProject();

    expect(loaded?.assets.asset1?.objectUrl).toBe('blob:hero');
    expect(createObjectUrl).toHaveBeenCalled();
  });

  it('updates project JSON during autosave', async () => {
    const root = new MockDirectoryHandle();
    const repository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage: new MemoryStorage(),
    });
    const project = sampleProject.createSampleProject();

    await repository.saveProject(project);
    await repository.saveProject({ ...project, name: 'Renamed Deck' });

    const projectDirectory = await getProjectDirectory(root, 'Renamed Deck');
    expect(JSON.parse(await readMockText(projectDirectory.files.get('project.json')!))).toMatchObject({
      name: 'Renamed Deck',
    });
  });

  it('writes and reads OPFS version history', async () => {
    const root = new MockDirectoryHandle();
    const repository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage: new MemoryStorage(),
    });
    const project = sampleProject.createSampleProject();

    await repository.saveProject(project);
    const version = await repository.saveVersion(
      { ...project, name: 'Versioned Deck' },
      { previousProject: project },
    );

    const history = await repository.getVersionHistory();
    const loadedVersion = await repository.loadVersion(version.id);
    const projectDirectory = await getProjectDirectory(root, 'Versioned Deck');
    const historyDirectory = projectDirectory.directories.get('history')!;

    expect(history).toHaveLength(1);
    expect(JSON.parse(await readMockText(historyDirectory.files.get('manifest.json')!))).toMatchObject({
      latestVersionId: version.id,
    });
    expect(loadedVersion?.name).toBe('Versioned Deck');
  });

  it('surfaces unavailable OPFS errors without creating fallback state', async () => {
    const repository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.reject(new DOMException('Private browsing', 'SecurityError')),
      storage: new MemoryStorage(),
    });

    await expect(repository.saveProject(sampleProject.createSampleProject())).rejects.toMatchObject({
      name: 'SecurityError',
    });
  });
});
