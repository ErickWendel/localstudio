import type { ProjectDocument } from '../../../src/domain/model';
import { createSampleProject } from '../../../src/domain/sampleProject';
import {
  BrowserFileSystemProjectRepository,
  type RecentProjectHandleStore,
} from '../../../src/services/browserFileSystemProjectRepository';

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
    return Promise.resolve(new MockWritable((value) => this.files.set(this.name, value)));
  }
  getFile(): Promise<{ text: () => Promise<string>; type: string }> {
    const value = this.files.get(this.name);
    if (value === undefined) return Promise.reject(new DOMException('Not found', 'NotFoundError'));
    if (typeof value === 'string')
      return Promise.resolve({ text: () => Promise.resolve(value), type: 'application/json' });
    return Promise.resolve(value);
  }
}

class MockDirectoryHandle {
  readonly files = new Map<string, string | Blob>();
  readonly directories = new Map<string, MockDirectoryHandle>();
  getFileHandle(name: string, options?: { create?: boolean }): Promise<MockFileHandle> {
    if (!options?.create && !this.files.has(name)) throw new DOMException('Not found', 'NotFoundError');
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
  load(): Promise<FileSystemDirectoryHandle | null> {
    return Promise.resolve(this.handle);
  }
  save(handle: FileSystemDirectoryHandle): Promise<void> {
    this.handle = handle;
    return Promise.resolve();
  }
}

describe('BrowserFileSystemProjectRepository asset files', () => {
  it('moves data URL image assets into assets/ and saves metadata in project.json', async () => {
    const directory = new MockDirectoryHandle();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = createSampleProject();
    project.assets['asset-hero'] = {
      ...project.assets['asset-hero']!,
      objectUrl: 'data:image/png;base64,aGVsbG8=',
    };

    await repository.saveProject(project);

    const assetsDirectory = directory.directories.get('assets')!;
    expect(assetsDirectory.files.has('asset-hero.png')).toBe(true);
    const savedAssetFile = assetsDirectory.files.get('asset-hero.png');
    expect(savedAssetFile).toBeInstanceOf(Blob);
    expect((savedAssetFile as Blob).type).toBe('image/png');
    expect(await (savedAssetFile as Blob).text()).toBe('hello');
    const savedProject = JSON.parse(directory.files.get('project.json') as string) as ProjectDocument;
    const savedAsset = savedProject.assets['asset-hero'];
    if (!savedAsset) throw new Error('Expected asset-hero to be saved in project.json');
    expect(savedAsset).toMatchObject({
      id: 'asset-hero',
      fileName: 'asset-hero.png',
      storage: 'file',
    });
    expect(savedAsset.objectUrl).toBeUndefined();
  });

  it('hydrates file-backed image assets with object URLs on load', async () => {
    const directory = new MockDirectoryHandle();
    const assetsDirectory = new MockDirectoryHandle();
    directory.directories.set('assets', assetsDirectory);
    assetsDirectory.files.set('asset-hero.png', new Blob(['hello'], { type: 'image/png' }));
    directory.files.set(
      'project.json',
      JSON.stringify({
        ...createSampleProject(),
        assets: {
          'asset-hero': {
            id: 'asset-hero',
            type: 'image',
            name: 'Hero',
            mimeType: 'image/png',
            storage: 'file',
            fileName: 'asset-hero.png',
          },
        },
      }),
    );
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    const loaded = await repository.importProject();

    expect(loaded?.assets['asset-hero']?.objectUrl).toMatch(/^blob:/);
  });

  it('keeps hydrated file-backed object URLs out of project.json when saved again', async () => {
    const directory = new MockDirectoryHandle();
    const assetsDirectory = new MockDirectoryHandle();
    directory.directories.set('assets', assetsDirectory);
    const assetFile = new Blob(['hello'], { type: 'image/png' });
    assetsDirectory.files.set('asset-hero.png', assetFile);
    directory.files.set(
      'project.json',
      JSON.stringify({
        ...createSampleProject(),
        assets: {
          'asset-hero': {
            id: 'asset-hero',
            type: 'image',
            name: 'Hero',
            mimeType: 'image/png',
            storage: 'file',
            fileName: 'asset-hero.png',
          },
        },
      }),
    );
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    const loaded = await repository.importProject();
    if (!loaded) throw new Error('Expected project to load');
    await repository.saveProject(loaded);

    expect(assetsDirectory.files.get('asset-hero.png')).toBe(assetFile);
    const savedProject = JSON.parse(directory.files.get('project.json') as string) as ProjectDocument;
    const savedAsset = savedProject.assets['asset-hero'];
    if (!savedAsset) throw new Error('Expected asset-hero to be saved in project.json');
    expect(savedAsset).toMatchObject({
      id: 'asset-hero',
      fileName: 'asset-hero.png',
      storage: 'file',
    });
    expect(savedAsset.objectUrl).toBeUndefined();
  });

  it('rejects when project.json references a missing file-backed asset', async () => {
    const directory = new MockDirectoryHandle();
    directory.files.set(
      'project.json',
      JSON.stringify({
        ...createSampleProject(),
        assets: {
          'asset-hero': {
            id: 'asset-hero',
            type: 'image',
            name: 'Hero',
            mimeType: 'image/png',
            storage: 'file',
            fileName: 'missing.png',
          },
        },
      }),
    );
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    await expect(repository.importProject()).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
