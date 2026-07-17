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
    await Promise.resolve();
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
  await Promise.resolve();
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
    expect(
      JSON.parse(await readMockText(projectDirectory.files.get('project.json')!)),
    ).toMatchObject({
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
    projectDirectory.directories
      .get('assets')!
      .files.set('hero.png', new Blob(['image'], { type: 'image/png' }));

    const loaded = await new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage,
    }).loadProject();

    expect(loaded?.assets.asset1?.objectUrl).toBe('blob:hero');
    expect(createObjectUrl).toHaveBeenCalled();
  });

  it('downloads remote assets on OPFS load and saves them as local files', async () => {
    const root = new MockDirectoryHandle();
    const storage = new MemoryStorage();
    const fetchRemoteAsset = vi.fn(() =>
      Promise.resolve(
        new Response('remote gif', { headers: { 'content-type': 'image/gif' } }),
      ),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('remote gif', { headers: { 'content-type': 'image/gif' } }),
    );
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:remote-gif');
    const project: ProjectDocument = {
      ...sampleProject.createSampleProject(),
      assets: {
        'asset-remote': {
          id: 'asset-remote',
          type: 'gif',
          name: 'Remote GIF',
          mimeType: 'image/gif',
          objectUrl: 'https://media.giphy.com/media/legacy/giphy.gif',
          storage: 'remote',
        },
      },
    };

    await new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage,
    }).saveProject(project);
    const projectDirectory = await getProjectDirectory(root, project.name);
    projectDirectory.files.set('project.json', JSON.stringify(project));

    const repository = new OpfsProjectRepository({
      fetch: fetchRemoteAsset as unknown as typeof fetch,
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage,
    });
    const loaded = await repository.loadProject();
    if (!loaded) throw new Error('Expected project to load');
    await repository.saveProject(loaded);

    expect(fetchRemoteAsset).toHaveBeenCalledWith('https://media.giphy.com/media/legacy/giphy.gif');
    expect(createObjectUrl).toHaveBeenCalled();
    expect(loaded.assets['asset-remote']).toMatchObject({
      objectUrl: 'blob:remote-gif',
    });
    expect(loaded.assets['asset-remote']?.storage).toBeUndefined();
    expect(await (projectDirectory.directories.get('assets')!.files.get('asset-remote.gif') as Blob).text()).toBe('remote gif');
    const savedProject = JSON.parse(
      await readMockText(projectDirectory.files.get('project.json')!),
    ) as ProjectDocument;
    expect(savedProject.assets['asset-remote']).toMatchObject({
      fileName: 'asset-remote.gif',
      storage: 'file',
    });
    expect(savedProject.assets['asset-remote']?.objectUrl).toBeUndefined();
  });

  it('persists project fonts under fonts and hydrates object URLs on load', async () => {
    const root = new MockDirectoryHandle();
    const storage = new MemoryStorage();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:font');
    const repository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage,
    });
    const project: ProjectDocument = {
      ...sampleProject.createSampleProject(),
      fonts: {
        montserrat: {
          id: 'montserrat',
          family: 'Montserrat',
          requestedFamily: 'Montserrat',
          source: 'google-fonts',
          fontStyle: 'normal',
          fontWeight: 700,
          mimeType: 'font/woff2',
          fileName: 'montserrat-700.woff2',
          storage: 'inline',
          objectUrl: 'data:font/woff2;base64,Zm9udA==',
        },
      },
    };

    await repository.saveProject(project);

    const projectDirectory = await getProjectDirectory(root, project.name);
    const fontsDirectory = projectDirectory.directories.get('fonts');
    const projectJson = JSON.parse(
      await readMockText(projectDirectory.files.get('project.json')!),
    ) as ProjectDocument;
    expect(fontsDirectory?.files.has('montserrat-700.woff2')).toBe(true);
    expect(projectJson.fonts?.montserrat).toMatchObject({
      fileName: 'montserrat-700.woff2',
      storage: 'file',
    });
    expect(projectJson.fonts?.montserrat?.objectUrl).toBeUndefined();

    const loaded = await new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage,
    }).loadProject();

    expect(loaded?.fonts?.montserrat?.objectUrl).toBe('blob:font');
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
    expect(
      JSON.parse(await readMockText(projectDirectory.files.get('project.json')!)),
    ).toMatchObject({
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
    expect(
      JSON.parse(await readMockText(historyDirectory.files.get('manifest.json')!)),
    ).toMatchObject({
      latestVersionId: version.id,
    });
    expect(loadedVersion?.name).toBe('Versioned Deck');
  });

  it('keeps image asset files that are still referenced by OPFS version history', async () => {
    const root = new MockDirectoryHandle();
    const repository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.resolve(root as unknown as FileSystemDirectoryHandle),
      storage: new MemoryStorage(),
    });
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:history-image');
    const projectWithImage = sampleProject.createBlankProject();
    projectWithImage.assets['asset-history-image'] = {
      id: 'asset-history-image',
      type: 'image',
      name: 'History image',
      mimeType: 'image/png',
      objectUrl: 'data:image/png;base64,aGlzdG9yeQ==',
    };
    projectWithImage.elements['image-history'] = {
      id: 'image-history',
      type: 'image',
      assetId: 'asset-history-image',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
    };
    projectWithImage.pages[0]?.elementIds.push('image-history');

    await repository.saveProject(projectWithImage);
    const version = await repository.saveVersion(projectWithImage, {
      previousProject: sampleProject.createBlankProject(),
    });
    await repository.saveProject({
      ...projectWithImage,
      assets: {},
      elements: {},
      pages: projectWithImage.pages.map((page) => ({ ...page, elementIds: [] })),
    });

    const projectDirectory = await getProjectDirectory(root, projectWithImage.name);
    const assetsDirectory = projectDirectory.directories.get('assets')!;
    expect(assetsDirectory.files.has('asset-history-image.png')).toBe(true);
    const loadedVersion = await repository.loadVersion(version.id);
    expect(loadedVersion?.assets['asset-history-image']?.objectUrl).toBe('blob:history-image');
    expect(createObjectUrl).toHaveBeenCalled();
  });

  it('surfaces unavailable OPFS errors without creating fallback state', async () => {
    const repository = new OpfsProjectRepository({
      getRootDirectory: () => Promise.reject(new DOMException('Private browsing', 'SecurityError')),
      storage: new MemoryStorage(),
    });

    await expect(repository.saveProject(sampleProject.createSampleProject())).rejects.toMatchObject(
      {
        name: 'SecurityError',
      },
    );
  });
});
