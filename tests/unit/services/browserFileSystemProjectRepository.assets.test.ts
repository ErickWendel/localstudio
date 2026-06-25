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
    return Promise.resolve({ text: () => value.text(), type: value.type });
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
});
