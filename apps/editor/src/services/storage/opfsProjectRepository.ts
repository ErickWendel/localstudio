import type { ProjectDocument } from '../../domain/documents/model';
import type {
  MirrorFile,
  ProjectRepository,
  VersionHistoryEntry,
  VersionHistoryManifest,
  VersionSnapshotMetadata,
} from '../contracts/interfaces';
import { browserStorage, type BrowserKeyValueStorage } from '../browser/browserStorage';
import { assetFileUtils } from './assetFileUtils';
import { projectVersionHistoryUtils } from './projectVersionHistoryUtils';

interface OpfsProjectRepositoryOptions {
  fetch?: typeof fetch;
  getRootDirectory?: () => Promise<FileSystemDirectoryHandle>;
  storage?: BrowserKeyValueStorage;
}

interface HydrateProjectAssetsOptions {
  allowMissingAssetFiles?: boolean;
}

type NavigatorWithOpfs = Navigator & {
  storage?: StorageManager & {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  };
};

const PROJECTS_DIRECTORY_NAME = 'projects';
const PROJECT_FILE_NAME = 'project.json';
const PROJECT_CONFIG_FILE_NAME = 'localstudio.json';
const VERSION_HISTORY_FILE_NAME = 'manifest.json';
const VERSION_HISTORY_LIMIT = 100;
const LAST_PROJECT_NAME_KEY = 'localstudio.ai.opfs.last-project-name';

function addRetainedFileName(fileNames: Set<string>, fileName: string | undefined) {
  if (fileName) fileNames.add(fileName);
}

async function createFileBackedProjectSnapshot(
  project: ProjectDocument,
  assetsDirectory: FileSystemDirectoryHandle,
  fontsDirectory: FileSystemDirectoryHandle,
  recordingsDirectory: FileSystemDirectoryHandle,
): Promise<ProjectDocument> {
  const projectAssets = project.assets;
  const projectFonts = project.fonts ?? {};
  const projectRecordings = project.recordings ?? {};
  const projectForDisk: ProjectDocument = {
    ...project,
    assets: { ...projectAssets },
    ...(project.fonts ? { fonts: { ...projectFonts } } : {}),
    ...(project.recordings ? { recordings: { ...projectRecordings } } : {}),
  };

  for (const [assetId, asset] of Object.entries(projectAssets)) {
    if (asset.storage === 'file' && asset.fileName) {
      const assetForDisk = { ...asset };
      delete assetForDisk.objectUrl;
      projectForDisk.assets[assetId] = assetForDisk;
      continue;
    }

    if (!assetFileUtils.isReadableObjectUrl(asset.objectUrl)) continue;
    const fileName = asset.fileName ?? `${assetId}.${assetFileUtils.getAssetFileExtension(asset.mimeType)}`;
    await writeBlobFileToDirectory(
      assetsDirectory,
      fileName,
      await assetFileUtils.objectUrlToBlob(asset.objectUrl),
    );
    const assetForDisk = { ...asset };
    delete assetForDisk.objectUrl;
    projectForDisk.assets[assetId] = {
      ...assetForDisk,
      fileName,
      storage: 'file',
    };
  }

  for (const [fontId, font] of Object.entries(projectFonts)) {
    if (font.storage === 'file' && font.fileName) {
      const fontForDisk = { ...font };
      delete fontForDisk.objectUrl;
      projectForDisk.fonts![fontId] = fontForDisk;
      continue;
    }

    if (!assetFileUtils.isReadableObjectUrl(font.objectUrl)) continue;
    await writeBlobFileToDirectory(
      fontsDirectory,
      font.fileName,
      await assetFileUtils.objectUrlToBlob(font.objectUrl),
    );
    const fontForDisk = { ...font };
    delete fontForDisk.objectUrl;
    projectForDisk.fonts![fontId] = {
      ...fontForDisk,
      storage: 'file',
    };
  }

  for (const [recordingId, recording] of Object.entries(projectRecordings)) {
    const audio = recording.audio;
    if (audio.storage === 'file' && audio.fileName) {
      const audioForDisk = { ...audio };
      delete audioForDisk.objectUrl;
      projectForDisk.recordings![recordingId] = {
        ...recording,
        audio: audioForDisk,
      };
      continue;
    }

    if (!assetFileUtils.isReadableObjectUrl(audio.objectUrl)) continue;
    const fileName =
      audio.fileName ??
      `${recordingId}.${assetFileUtils.getAssetFileExtension(audio.mimeType)}`;
    await writeBlobFileToDirectory(
      recordingsDirectory,
      fileName,
      await assetFileUtils.objectUrlToBlob(audio.objectUrl),
    );
    const audioForDisk = { ...audio };
    delete audioForDisk.objectUrl;
    projectForDisk.recordings![recordingId] = {
      ...recording,
      audio: {
        ...audioForDisk,
        fileName,
        storage: 'file',
      },
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

async function readProjectNameFromMirrorFiles(files: MirrorFile[]) {
  const projectFile = files.find((file) => file.path === PROJECT_FILE_NAME);
  if (!projectFile) return undefined;
  const project = JSON.parse(await projectFile.blob.text()) as ProjectDocument;
  return project.name.trim() || undefined;
}

function isNotFoundError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

function getDefaultFetch() {
  if (typeof globalThis.fetch !== 'function') return undefined;
  return globalThis.fetch.bind(globalThis);
}

function normalizeProjectDirectoryName(projectName: string | undefined) {
  const normalizedName = projectName?.trim();
  if (!normalizedName) return 'untitled-project';
  return encodeURIComponent(normalizedName).replaceAll('.', '%2E');
}

export class OpfsProjectRepository implements ProjectRepository {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private projectDirectoryName: string | null = null;
  private readonly storage: BrowserKeyValueStorage | undefined;

  constructor(private readonly options: OpfsProjectRepositoryOptions = {}) {
    this.storage = options.storage ?? browserStorage.getBrowserLocalStorage();
  }

  async importMirrorFiles(files: MirrorFile[]): Promise<ProjectDocument> {
    const mirrorFiles = Array.isArray(files) ? files : [files];
    const projectDirectoryName = normalizeProjectDirectoryName(
      await readProjectNameFromMirrorFiles(mirrorFiles),
    );
    const projectsDirectory = await this.getProjectsDirectory();
    this.directoryHandle = await projectsDirectory.getDirectoryHandle(projectDirectoryName, {
      create: true,
    });
    this.projectDirectoryName = projectDirectoryName;
    for (const file of mirrorFiles) {
      await this.writeMirrorFile(this.directoryHandle, file);
    }
    const project = await this.readProjectFromDirectory(this.directoryHandle, {
      allowMissingAssetFiles: true,
    });
    if (!project) throw new Error('The mirrored project did not include project.json.');
    this.rememberProject(project.name);
    return project;
  }

  async loadProject(options?: { projectName?: string }): Promise<ProjectDocument | null> {
    const projectName = options?.projectName ?? this.storage?.getItem(LAST_PROJECT_NAME_KEY) ?? undefined;
    if (!projectName) return null;
    const projectsDirectory = await this.getProjectsDirectory();
    const projectDirectoryName = normalizeProjectDirectoryName(projectName);
    try {
      this.directoryHandle = await projectsDirectory.getDirectoryHandle(projectDirectoryName);
      this.projectDirectoryName = projectDirectoryName;
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
    return this.readProjectFromDirectory(this.directoryHandle);
  }

  async saveProject(
    project: ProjectDocument,
    options?: { projectDirectoryName?: string },
  ): Promise<void> {
    const previousProjectDirectoryName = this.projectDirectoryName;
    const directoryHandle = await this.ensureProjectDirectory(
      options?.projectDirectoryName ?? project.name,
    );
    const assetsDirectory = await directoryHandle.getDirectoryHandle('assets', { create: true });
    const fontsDirectory = await directoryHandle.getDirectoryHandle('fonts', { create: true });
    const recordingsDirectory = await directoryHandle.getDirectoryHandle('recordings', {
      create: true,
    });
    await Promise.all([
      directoryHandle.getDirectoryHandle('cache', { create: true }),
      directoryHandle.getDirectoryHandle('config', { create: true }),
    ]);

    const projectForDisk = await createFileBackedProjectSnapshot(
      project,
      assetsDirectory,
      fontsDirectory,
      recordingsDirectory,
    );
    const retainedAssetFileNames = new Set(
      Object.values(projectForDisk.assets)
        .map((asset) => asset.fileName)
        .filter((fileName): fileName is string => Boolean(fileName)),
    );
    await this.addVersionAssetFileNames(directoryHandle, retainedAssetFileNames);
    await this.removeUnretainedAssetFiles(assetsDirectory, retainedAssetFileNames);
    const retainedFontFileNames = new Set<string>();
    for (const font of Object.values(projectForDisk.fonts ?? {})) {
      addRetainedFileName(retainedFontFileNames, font.fileName);
    }
    await this.addVersionFontFileNames(directoryHandle, retainedFontFileNames);
    await this.removeUnretainedAssetFiles(fontsDirectory, retainedFontFileNames);
    const retainedRecordingFileNames = new Set<string>();
    for (const recording of Object.values(projectForDisk.recordings ?? {})) {
      addRetainedFileName(retainedRecordingFileNames, recording.audio.fileName);
    }
    await this.addVersionRecordingFileNames(directoryHandle, retainedRecordingFileNames);
    await this.removeUnretainedAssetFiles(recordingsDirectory, retainedRecordingFileNames);
    await this.writeJsonFile(directoryHandle, PROJECT_FILE_NAME, projectForDisk);
    const configDirectory = await directoryHandle.getDirectoryHandle('config', { create: true });
    await this.writeJsonFile(configDirectory, PROJECT_CONFIG_FILE_NAME, {
      app: 'LocalStudio.dev',
      projectId: project.id,
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      storage: 'opfs',
    });
    if (
      previousProjectDirectoryName &&
      previousProjectDirectoryName !== this.projectDirectoryName
    ) {
      const projectsDirectory = await this.getProjectsDirectory();
      await projectsDirectory
        .removeEntry(previousProjectDirectoryName, { recursive: true })
        .catch(() => undefined);
    }
    this.rememberProject(project.name);
  }

  async saveProjectAs(
    project: ProjectDocument,
    options?: { projectDirectoryName?: string },
  ): Promise<void> {
    this.directoryHandle = null;
    this.projectDirectoryName = null;
    await this.saveProject(project, options);
  }

  async getVersionHistory(): Promise<VersionHistoryEntry[]> {
    const directoryHandle = await this.ensureProjectDirectory();
    const manifest = await this.readVersionHistoryManifest(directoryHandle);
    return manifest.versions;
  }

  async saveVersion(
    project: ProjectDocument,
    metadata: VersionSnapshotMetadata,
  ): Promise<VersionHistoryEntry> {
    const directoryHandle = await this.ensureProjectDirectory(project.name);
    const assetsDirectory = await directoryHandle.getDirectoryHandle('assets', { create: true });
    const fontsDirectory = await directoryHandle.getDirectoryHandle('fonts', { create: true });
    const recordingsDirectory = await directoryHandle.getDirectoryHandle('recordings', {
      create: true,
    });
    const historyDirectory = await directoryHandle.getDirectoryHandle('history', { create: true });
    const versionsDirectory = await historyDirectory.getDirectoryHandle('versions', {
      create: true,
    });
    const manifest = await this.readVersionHistoryManifest(directoryHandle, project.id);
    const createdAt = new Date().toISOString();
    const id = projectVersionHistoryUtils.createVersionId(new Date(createdAt));
    const fileName = `${id}.json`;
    const changeSummary = projectVersionHistoryUtils.createChangeSummary(project, metadata.previousProject);
    const entry: VersionHistoryEntry = {
      id,
      createdAt,
      authorName: 'Local user',
      projectName: project.name,
      summary: changeSummary.summary,
      changeCount: changeSummary.changeCount,
      fileName,
      ...(changeSummary.firstChangedPageId
        ? { firstChangedPageId: changeSummary.firstChangedPageId }
        : {}),
      ...(changeSummary.firstChangedElementId
        ? { firstChangedElementId: changeSummary.firstChangedElementId }
        : {}),
    };

    const projectForHistory = await createFileBackedProjectSnapshot(
      project,
      assetsDirectory,
      fontsDirectory,
      recordingsDirectory,
    );
    await this.writeJsonFile(
      versionsDirectory,
      fileName,
      projectVersionHistoryUtils.cloneProjectForHistory(projectForHistory),
    );
    const nextVersions = [entry, ...manifest.versions.filter((version) => version.id !== entry.id)];
    const retainedVersions = nextVersions.slice(0, VERSION_HISTORY_LIMIT);
    await this.removePrunedVersionFiles(
      versionsDirectory,
      nextVersions.slice(VERSION_HISTORY_LIMIT),
    );
    await this.writeJsonFile(historyDirectory, VERSION_HISTORY_FILE_NAME, {
      schemaVersion: 1,
      projectId: project.id,
      latestVersionId: entry.id,
      versions: retainedVersions,
    } satisfies VersionHistoryManifest);
    this.rememberProject(project.name);
    return entry;
  }

  async loadVersion(versionId: string): Promise<ProjectDocument | null> {
    const directoryHandle = await this.ensureProjectDirectory();
    const manifest = await this.readVersionHistoryManifest(directoryHandle);
    const entry = manifest.versions.find((version) => version.id === versionId);
    if (!entry) return null;
    try {
      const historyDirectory = await directoryHandle.getDirectoryHandle('history');
      const versionsDirectory = await historyDirectory.getDirectoryHandle('versions');
      const fileHandle = await versionsDirectory.getFileHandle(entry.fileName);
      const file = await fileHandle.getFile();
      return this.hydrateProjectFiles(JSON.parse(await file.text()) as ProjectDocument, {
        allowMissingAssetFiles: true,
      });
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  private async getProjectsDirectory() {
    const rootDirectory = await this.getRootDirectory();
    return rootDirectory.getDirectoryHandle(PROJECTS_DIRECTORY_NAME, { create: true });
  }

  private async getRootDirectory() {
    if (this.options.getRootDirectory) return this.options.getRootDirectory();
    const browserNavigator =
      typeof navigator === 'undefined' ? undefined : (navigator as NavigatorWithOpfs);
    if (!browserNavigator?.storage?.getDirectory) {
      throw new Error('Browser storage is not available in this browser.');
    }
    return browserNavigator.storage.getDirectory();
  }

  private async ensureProjectDirectory(projectName?: string): Promise<FileSystemDirectoryHandle> {
    const requestedProjectDirectoryName = normalizeProjectDirectoryName(
      projectName ?? this.storage?.getItem(LAST_PROJECT_NAME_KEY) ?? undefined,
    );
    if (!this.directoryHandle || requestedProjectDirectoryName !== this.projectDirectoryName) {
      const projectsDirectory = await this.getProjectsDirectory();
      this.directoryHandle = await projectsDirectory.getDirectoryHandle(requestedProjectDirectoryName, {
        create: true,
      });
      this.projectDirectoryName = requestedProjectDirectoryName;
    }
    return this.directoryHandle;
  }

  private async writeJsonFile(
    directoryHandle: FileSystemDirectoryHandle,
    fileName: string,
    value: unknown,
  ) {
    const temporaryFileName = `${fileName}.tmp`;
    await this.writeTextFile(directoryHandle, temporaryFileName, JSON.stringify(value, null, 2));
    await this.writeTextFile(directoryHandle, fileName, JSON.stringify(value, null, 2));
    await directoryHandle.removeEntry(temporaryFileName).catch(() => undefined);
  }

  private async writeTextFile(
    directoryHandle: FileSystemDirectoryHandle,
    fileName: string,
    value: string,
  ) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(value);
    await writable.close();
  }

  private async removeUnretainedAssetFiles(
    directoryHandle: FileSystemDirectoryHandle,
    retainedAssetFileNames: Set<string>,
  ) {
    const entries = (directoryHandle as unknown as {
      entries?: () => AsyncIterable<[string, { kind?: string }]>;
    }).entries;
    if (!entries) return;

    const removals: Array<Promise<void>> = [];
    for await (const [name, handle] of entries.call(directoryHandle)) {
      if (handle.kind !== 'file' || retainedAssetFileNames.has(name)) continue;
      removals.push(directoryHandle.removeEntry(name).catch(() => undefined));
    }
    await Promise.all(removals);
  }

  private async addVersionAssetFileNames(
    directoryHandle: FileSystemDirectoryHandle,
    retainedAssetFileNames: Set<string>,
  ) {
    await this.addVersionFileNames(directoryHandle, (versionProject) => {
      for (const asset of Object.values(versionProject.assets)) {
        addRetainedFileName(retainedAssetFileNames, asset.fileName);
      }
    });
  }

  private async addVersionFontFileNames(
    directoryHandle: FileSystemDirectoryHandle,
    retainedFontFileNames: Set<string>,
  ) {
    await this.addVersionFileNames(directoryHandle, (versionProject) => {
      for (const font of Object.values(versionProject.fonts ?? {})) {
        addRetainedFileName(retainedFontFileNames, font.fileName);
      }
    });
  }

  private async addVersionRecordingFileNames(
    directoryHandle: FileSystemDirectoryHandle,
    retainedRecordingFileNames: Set<string>,
  ) {
    await this.addVersionFileNames(directoryHandle, (versionProject) => {
      for (const recording of Object.values(versionProject.recordings ?? {})) {
        addRetainedFileName(retainedRecordingFileNames, recording.audio.fileName);
      }
    });
  }

  private async addVersionFileNames(
    directoryHandle: FileSystemDirectoryHandle,
    addProjectFileNames: (versionProject: ProjectDocument) => void,
  ) {
    let manifest: VersionHistoryManifest;
    let versionsDirectory: FileSystemDirectoryHandle;
    try {
      const historyDirectory = await directoryHandle.getDirectoryHandle('history');
      const manifestHandle = await historyDirectory.getFileHandle(VERSION_HISTORY_FILE_NAME);
      const manifestFile = await manifestHandle.getFile();
      manifest = JSON.parse(await manifestFile.text()) as VersionHistoryManifest;
      versionsDirectory = await historyDirectory.getDirectoryHandle('versions');
    } catch (error) {
      if (isNotFoundError(error)) return;
      throw error;
    }
    if (manifest.versions.length === 0) return;
    await Promise.all(
      manifest.versions.map(async (entry) => {
        try {
          const fileHandle = await versionsDirectory.getFileHandle(entry.fileName);
          const file = await fileHandle.getFile();
          addProjectFileNames(JSON.parse(await file.text()) as ProjectDocument);
        } catch (error) {
          if (!isNotFoundError(error)) throw error;
        }
      }),
    );
  }

  private async writeMirrorFile(directoryHandle: FileSystemDirectoryHandle, file: MirrorFile) {
    const pathParts = file.path.split('/').filter(Boolean);
    const fileName = pathParts.pop();
    if (!fileName) return;
    let currentDirectory = directoryHandle;
    for (const directoryName of pathParts) {
      currentDirectory = await currentDirectory.getDirectoryHandle(directoryName, { create: true });
    }
    await writeBlobFileToDirectory(currentDirectory, fileName, file.blob);
  }

  private async removePrunedVersionFiles(
    directoryHandle: FileSystemDirectoryHandle,
    entries: VersionHistoryEntry[],
  ) {
    await Promise.all(
      entries.map((entry) => directoryHandle.removeEntry(entry.fileName).catch(() => undefined)),
    );
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
      if (!isNotFoundError(error)) throw error;
      return { schemaVersion: 1, projectId, versions: [] };
    }
  }

  private async readProjectFromDirectory(
    directoryHandle: FileSystemDirectoryHandle,
    options: HydrateProjectAssetsOptions = {},
  ): Promise<ProjectDocument | null> {
    let file: File;
    try {
      const fileHandle = await directoryHandle.getFileHandle(PROJECT_FILE_NAME);
      file = await fileHandle.getFile();
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }

    const project = JSON.parse(await file.text()) as ProjectDocument;
    return this.hydrateProjectFiles(project, options);
  }

  private async hydrateProjectFiles(
    project: ProjectDocument,
    options: HydrateProjectAssetsOptions = {},
  ): Promise<ProjectDocument> {
    if (!this.directoryHandle) return project;
    const assets: ProjectDocument['assets'] = {};
    const fonts: ProjectDocument['fonts'] = {};
    const recordings: ProjectDocument['recordings'] = {};
    let assetsDirectory: FileSystemDirectoryHandle | undefined;
    let fontsDirectory: FileSystemDirectoryHandle | undefined;
    let recordingsDirectory: FileSystemDirectoryHandle | undefined;

    for (const [assetId, asset] of Object.entries(project.assets)) {
      if (asset.storage !== 'file' || !asset.fileName) {
        const objectUrl =
          asset.storage === 'remote'
            ? await assetFileUtils.remoteObjectUrlToLocalObjectUrl(
                asset.objectUrl,
                asset.mimeType,
                this.options.fetch ?? getDefaultFetch(),
              )
            : undefined;
        if (objectUrl) {
          const { storage, ...assetWithoutStorage } = asset;
          void storage;
          assets[assetId] = { ...assetWithoutStorage, objectUrl };
        } else {
          assets[assetId] = asset;
        }
        continue;
      }
      try {
        assetsDirectory ??= await this.directoryHandle.getDirectoryHandle('assets');
        const fileHandle = await assetsDirectory.getFileHandle(asset.fileName);
        const file = await fileHandle.getFile();
        assets[assetId] = {
          ...asset,
          objectUrl: URL.createObjectURL(file),
        };
      } catch (error) {
        if (!isNotFoundError(error) || !options.allowMissingAssetFiles) throw error;
        assets[assetId] = asset;
      }
    }

    for (const [fontId, font] of Object.entries(project.fonts ?? {})) {
      if (font.storage !== 'file' || !font.fileName) {
        fonts[fontId] = font;
        continue;
      }
      try {
        fontsDirectory ??= await this.directoryHandle.getDirectoryHandle('fonts');
        const fileHandle = await fontsDirectory.getFileHandle(font.fileName);
        const file = await fileHandle.getFile();
        fonts[fontId] = {
          ...font,
          objectUrl: URL.createObjectURL(file),
        };
      } catch (error) {
        if (!isNotFoundError(error) || !options.allowMissingAssetFiles) throw error;
        fonts[fontId] = font;
      }
    }

    for (const [recordingId, recording] of Object.entries(project.recordings ?? {})) {
      const audio = recording.audio;
      if (audio.storage !== 'file' || !audio.fileName) {
        recordings[recordingId] = recording;
        continue;
      }
      try {
        recordingsDirectory ??= await this.directoryHandle.getDirectoryHandle('recordings');
        const fileHandle = await recordingsDirectory.getFileHandle(audio.fileName);
        const file = await fileHandle.getFile();
        recordings[recordingId] = {
          ...recording,
          audio: {
            ...audio,
            objectUrl: URL.createObjectURL(file),
          },
        };
      } catch (error) {
        if (!isNotFoundError(error) || !options.allowMissingAssetFiles) throw error;
        recordings[recordingId] = recording;
      }
    }

    return {
      ...project,
      assets,
      ...(project.fonts ? { fonts } : {}),
      ...(project.recordings ? { recordings } : {}),
    };
  }

  private rememberProject(projectName: string) {
    this.storage?.setItem(LAST_PROJECT_NAME_KEY, projectName);
  }
}
