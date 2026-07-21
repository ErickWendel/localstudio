import { sampleProject } from '../../../src/domain/projects/sampleProject';
import {
  BrowserFileSystemProjectRepository,
  type RecentProjectHandleStore,
} from '../../../src/services/storage/browserFileSystemProjectRepository';

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
    if (typeof value === 'string')
      return Promise.resolve({ text: () => Promise.resolve(value), type: 'application/json' });
    return Promise.resolve(value);
  }
}

class MockDirectoryHandle {
  constructor(
    readonly name = 'LocalStudio Project',
    private readonly permissionState: PermissionState = 'granted',
    private readonly childPermissionState: PermissionState = permissionState,
  ) {}

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
      this.directories.set(
        name,
        new MockDirectoryHandle(name, this.childPermissionState, this.childPermissionState),
      );
    }
    return Promise.resolve(this.directories.get(name)!);
  }

  queryPermission(): Promise<PermissionState> {
    return Promise.resolve(this.permissionState);
  }

  requestPermission(): Promise<PermissionState> {
    return Promise.resolve(this.permissionState);
  }

  removeEntry(name: string): Promise<void> {
    this.files.delete(name);
    this.directories.delete(name);
    return Promise.resolve();
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

async function readMockText(value: string | Blob) {
  return typeof value === 'string' ? value : value.text();
}

describe('BrowserFileSystemProjectRepository', () => {
  it('creates the project folder structure and writes project metadata', async () => {
    const directory = new MockDirectoryHandle();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = sampleProject.createSampleProject();

    await repository.saveProject(project);

    expect(directory.directories.has('assets')).toBe(true);
    expect(directory.directories.has('cache')).toBe(true);
    expect(directory.directories.has('config')).toBe(true);
    expect(JSON.parse(await readMockText(directory.files.get('project.json')!))).toMatchObject({
      id: project.id,
      name: project.name,
    });
    expect(
      JSON.parse(
        await readMockText(directory.directories.get('config')!.files.get('localstudio.json')!),
      ),
    ).toMatchObject({
      app: 'LocalStudio.dev',
      projectId: project.id,
    });
  });

  it('loads project.json from the selected folder after saving', async () => {
    const directory = new MockDirectoryHandle();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = sampleProject.createSampleProject();

    await repository.saveProject(project);
    const loaded = await repository.loadProject();

    expect(loaded?.id).toBe(project.id);
    expect(loaded?.pages).toHaveLength(1);
  });

  it('creates a named child project folder during initial persistence setup', async () => {
    const parentDirectory = new MockDirectoryHandle('Projects');
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(parentDirectory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = { ...sampleProject.createSampleProject(), name: 'Launch Deck' };

    await repository.saveProject(project, { projectDirectoryName: 'Launch Deck' });

    const projectDirectory = parentDirectory.directories.get('Launch Deck')!;
    expect(projectDirectory).toBeDefined();
    expect(JSON.parse(await readMockText(projectDirectory.files.get('project.json')!))).toMatchObject({
      name: 'Launch Deck',
    });
  });

  it('uses the picked parent permission when creating the named project folder', async () => {
    const parentDirectory = new MockDirectoryHandle('Projects', 'granted', 'denied');
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(parentDirectory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = { ...sampleProject.createSampleProject(), name: 'Launch Deck' };

    await repository.saveProject(project, { projectDirectoryName: 'Launch Deck' });

    const projectDirectory = parentDirectory.directories.get('Launch Deck')!;
    expect(projectDirectory).toBeDefined();
    expect(JSON.parse(await readMockText(projectDirectory.files.get('project.json')!))).toMatchObject({
      name: 'Launch Deck',
    });
  });

  it('prompts for a new parent folder when saving a project as another local folder', async () => {
    const firstParentDirectory = new MockDirectoryHandle('First Projects');
    const secondParentDirectory = new MockDirectoryHandle('Second Projects');
    const pickDirectory = vi
      .fn()
      .mockResolvedValueOnce(firstParentDirectory)
      .mockResolvedValueOnce(secondParentDirectory);
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory,
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = { ...sampleProject.createSampleProject(), name: 'Launch Deck' };

    await repository.saveProject(project, { projectDirectoryName: project.name });
    await repository.saveProjectAs(project, { projectDirectoryName: project.name });

    expect(pickDirectory).toHaveBeenCalledTimes(2);
    expect(firstParentDirectory.directories.get('Launch Deck')).toBeDefined();
    expect(secondParentDirectory.directories.get('Launch Deck')).toBeDefined();
    expect(
      JSON.parse(
        await readMockText(
          secondParentDirectory.directories.get('Launch Deck')!.files.get('project.json')!,
        ),
      ),
    ).toMatchObject({ name: 'Launch Deck' });
  });

  it('moves a persisted project into a renamed child folder when the project name changes', async () => {
    const parentDirectory = new MockDirectoryHandle('Projects');
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(parentDirectory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const project = { ...sampleProject.createSampleProject(), name: 'Launch Deck' };

    await repository.saveProject(project, { projectDirectoryName: 'Launch Deck' });
    await repository.saveProject({ ...project, name: 'Renamed Launch Deck' });

    expect(parentDirectory.directories.has('Launch Deck')).toBe(false);
    const renamedDirectory = parentDirectory.directories.get('Renamed Launch Deck')!;
    expect(renamedDirectory).toBeDefined();
    expect(JSON.parse(await readMockText(renamedDirectory.files.get('project.json')!))).toMatchObject({
      name: 'Renamed Launch Deck',
    });
  });

  it('imports an existing project folder without overwriting it first', async () => {
    const directory = new MockDirectoryHandle();
    const project = sampleProject.createSampleProject();
    directory.files.set('project.json', JSON.stringify({ ...project, name: 'Imported Project' }));
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    const importedProject = await repository.importProject();

    expect(importedProject?.name).toBe('Imported Project');
    expect(directory.directories.size).toBe(0);
  });

  it('imports a mirrored remote project into a child folder named from the remote project', async () => {
    const directory = new MockDirectoryHandle('Projects');
    const project = sampleProject.createSampleProject();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    const importedProject = await repository.importMirrorFiles([
      {
        path: 'project.json',
        blob: new Blob([JSON.stringify({ ...project, name: 'Remote Mirror' })], {
          type: 'application/json',
        }),
      },
      {
        path: 'config/localstudio.json',
        blob: new Blob(
          [JSON.stringify({ app: 'LocalStudio.dev', projectId: project.id, schemaVersion: 1 })],
          {
            type: 'application/json',
          },
        ),
      },
    ]);

    expect(importedProject.name).toBe('Remote Mirror');
    const projectDirectory = directory.directories.get('Remote Mirror')!;
    expect(projectDirectory).toBeDefined();
    expect(JSON.parse(await readMockText(projectDirectory.files.get('project.json')!))).toMatchObject({
      name: 'Remote Mirror',
    });
    expect(projectDirectory.directories.get('config')?.files.has('localstudio.json')).toBe(true);
  });

  it('can choose the mirrored import destination before remote files download', async () => {
    const directory = new MockDirectoryHandle('Projects');
    const project = sampleProject.createSampleProject();
    const pickDirectory = vi.fn(() =>
      Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
    );
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory,
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    await repository.prepareImportMirrorFiles();
    const importedProject = await repository.importMirrorFiles([
      {
        path: 'project.json',
        blob: new Blob([JSON.stringify({ ...project, name: 'Prepared Remote Mirror' })], {
          type: 'application/json',
        }),
      },
    ]);

    expect(pickDirectory).toHaveBeenCalledTimes(1);
    expect(importedProject.name).toBe('Prepared Remote Mirror');
    expect(directory.directories.has('Prepared Remote Mirror')).toBe(true);
  });

  it('keeps imported projects loadable when a mirrored asset file is missing locally', async () => {
    const directory = new MockDirectoryHandle('Projects');
    const project = {
      ...sampleProject.createSampleProject(),
      name: 'Remote Mirror',
      assets: {
        'missing-asset': {
          id: 'missing-asset',
          type: 'image',
          name: 'Missing asset',
          mimeType: 'image/png',
          storage: 'file',
          fileName: 'missing.png',
        },
      },
    };
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    const importedProject = await repository.importMirrorFiles([
      {
        path: 'project.json',
        blob: new Blob([JSON.stringify(project)], { type: 'application/json' }),
      },
    ]);

    expect(importedProject.assets['missing-asset']).toMatchObject({
      fileName: 'missing.png',
      storage: 'file',
    });
  });

  it('returns null when an imported version manifest references a missing snapshot file', async () => {
    const directory = new MockDirectoryHandle('Projects');
    const project = sampleProject.createSampleProject();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });

    await repository.importMirrorFiles([
      {
        path: 'project.json',
        blob: new Blob([JSON.stringify({ ...project, name: 'Remote Mirror' })], {
          type: 'application/json',
        }),
      },
      {
        path: 'history/manifest.json',
        blob: new Blob(
          [
            JSON.stringify({
              schemaVersion: 1,
              projectId: project.id,
              latestVersionId: 'version-missing',
              versions: [
                {
                  id: 'version-missing',
                  createdAt: '2026-06-30T10:00:00.000Z',
                  authorName: 'Local user',
                  projectName: 'Remote Mirror',
                  summary: 'Imported stale manifest',
                  changeCount: 1,
                  fileName: 'version-missing.json',
                },
              ],
            }),
          ],
          { type: 'application/json' },
        ),
      },
    ]);

    await expect(repository.loadVersion('version-missing')).resolves.toBeNull();
  });

  it('reopens the last project folder from the recent handle store', async () => {
    const directory = new MockDirectoryHandle();
    const recentProjectStore = new MemoryRecentProjectHandleStore();
    const project = sampleProject.createSampleProject();
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
    const alphaProject = { ...sampleProject.createSampleProject(), id: 'alpha', name: 'Alpha Deck' };
    const betaProject = { ...sampleProject.createSampleProject(), id: 'beta', name: 'Beta Deck' };

    await new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(alphaDirectory as unknown as FileSystemDirectoryHandle),
      recentProjectStore,
    }).saveProject(alphaProject);
    await new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(betaDirectory as unknown as FileSystemDirectoryHandle),
      recentProjectStore,
    }).saveProject(betaProject);

    const loaded = await new BrowserFileSystemProjectRepository({ recentProjectStore }).loadProject(
      {
        projectName: 'Alpha Deck',
      },
    );

    expect(loaded?.id).toBe('alpha');
    expect(loaded?.name).toBe('Alpha Deck');
  });

  it('saves and loads full project version snapshots with first-change metadata', async () => {
    const directory = new MockDirectoryHandle();
    const repository = new BrowserFileSystemProjectRepository({
      pickDirectory: () => Promise.resolve(directory as unknown as FileSystemDirectoryHandle),
      recentProjectStore: new MemoryRecentProjectHandleStore(),
    });
    const previousProject = sampleProject.createSampleProject();
    const nextProject = {
      ...previousProject,
      elements: {
        ...previousProject.elements,
        'text-title': {
          ...previousProject.elements['text-title']!,
          text: 'Versioned title',
        },
      },
    };

    await repository.saveProject(previousProject);
    const entry = await repository.saveVersion(nextProject, { previousProject });

    expect(entry).toMatchObject({
      authorName: 'Local user',
      firstChangedPageId: 'page-1',
      firstChangedElementId: 'text-title',
      projectName: previousProject.name,
    });
    expect(entry.changeCount).toBeGreaterThan(0);
    const historyDirectory = directory.directories.get('history')!;
    const versionsDirectory = historyDirectory.directories.get('versions')!;
    expect(
      JSON.parse(await readMockText(historyDirectory.files.get('manifest.json')!)),
    ).toMatchObject({
      latestVersionId: entry.id,
      versions: [expect.objectContaining({ id: entry.id })],
    });
    expect(versionsDirectory.files.has(entry.fileName)).toBe(true);

    const loadedVersion = await repository.loadVersion(entry.id);
    expect(loadedVersion?.elements['text-title']).toMatchObject({ text: 'Versioned title' });
  });
});
