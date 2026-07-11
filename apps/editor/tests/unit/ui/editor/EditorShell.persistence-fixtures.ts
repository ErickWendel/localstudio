import { vi } from 'vitest';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  MirrorFile,
  MirrorProjectSummary,
  MirrorService,
  MirrorState,
  ProjectRepository,
  ShareMetadata,
  ShareRecord,
  ShareService,
  VersionHistoryEntry,
} from '../../../../src/services/contracts/interfaces';
import type { MinioMirrorConfig } from '../../../../src/services/mirror/minioMirrorService';

class RejectingProjectRepository implements ProjectRepository {
  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(): Promise<void> {
    return Promise.reject(new Error('Folder permission denied'));
  }
}

class RejectingLoadProjectRepository implements ProjectRepository {
  loadProject(): Promise<ProjectDocument | null> {
    return Promise.reject(new DOMException('Missing asset file', 'NotFoundError'));
  }

  saveProject(): Promise<void> {
    return Promise.resolve();
  }
}

class SavingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];
  savedProjectsAs: ProjectDocument[] = [];

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }

  saveProjectAs(project: ProjectDocument): Promise<void> {
    this.savedProjectsAs.push(project);
    return Promise.resolve();
  }
}

class VersionHistoryProjectRepository extends SavingProjectRepository {
  constructor(
    private readonly project: ProjectDocument,
    private readonly versionProject: ProjectDocument,
    private readonly entries: VersionHistoryEntry[],
  ) {
    super();
  }

  override loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.project);
  }

  getVersionHistory(): Promise<VersionHistoryEntry[]> {
    return Promise.resolve(this.entries);
  }

  loadVersion(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.versionProject);
  }
}

class LoadingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];

  constructor(private readonly project: ProjectDocument) {}

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.project);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }
}

const mirrorConfig: MinioMirrorConfig = {
  accessKey: 'localstudio',
  bucket: 'localstudio',
  endpoint: 'http://localhost:9000',
  pathStyle: true,
  publicBaseUrl: 'http://localhost:9000/localstudio',
  region: 'us-east-1',
  secretKey: 'localstudio123',
  prefix: 'mirrors',
};

class RecordingMirrorService implements MirrorService<MinioMirrorConfig> {
  constructor(private readonly storedConfig: MinioMirrorConfig | null = mirrorConfig) {}

  clearConfig = vi.fn();

  syncProject = vi.fn(
    (
      project: ProjectDocument,
      repository: ProjectRepository,
      config: MinioMirrorConfig,
    ): Promise<MirrorState> => {
      void project;
      void repository;
      void config;
      return Promise.resolve({ enabled: true, status: 'synced' });
    },
  );

  loadConfig(): MinioMirrorConfig | null {
    return this.storedConfig;
  }

  saveConfig(): void {
    return undefined;
  }

  listProjects = vi.fn((): Promise<MirrorProjectSummary[]> => Promise.resolve([]));

  downloadProject = vi.fn((): Promise<MirrorFile[]> => Promise.resolve([]));

  deleteProject = vi.fn((): Promise<void> => Promise.resolve());
}

class RecordingShareService implements ShareService {
  records = new Map<string, ShareRecord>();

  constructor(private readonly origin = window.location.origin) {}

  createShare = vi.fn((project: ProjectDocument): Promise<ShareMetadata> => {
    const shareId = crypto.randomUUID();
    const now = new Date().toISOString();
    this.records.set(shareId, { shareId, createdAt: now, updatedAt: now, project });
    return Promise.resolve(this.createMetadata(shareId, now));
  });

  updateShare = vi.fn((shareId: string, project: ProjectDocument): Promise<ShareMetadata> => {
    const now = new Date().toISOString();
    this.records.set(shareId, { shareId, createdAt: now, updatedAt: now, project });
    return Promise.resolve(this.createMetadata(shareId, now));
  });

  getShare = vi.fn(
    (shareId: string): Promise<ShareRecord | null> =>
      Promise.resolve(this.records.get(shareId) ?? null),
  );

  getPublicUrl(shareId: string): string {
    return `${this.origin}/editor/s/${shareId}?src=${encodeURIComponent(
      `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`,
    )}`;
  }

  getEmbedUrl(shareId: string): string {
    return `${this.origin}/editor/embed/${shareId}?src=${encodeURIComponent(
      `http://localhost:9000/localstudio/mirrors/public-shares/${shareId}/share.json`,
    )}`;
  }

  getEmbedHtml(shareId: string): string {
    return `<iframe src="${this.getEmbedUrl(shareId)}" width="960" height="540"></iframe>`;
  }

  private createMetadata(shareId: string, timestamp: string): ShareMetadata {
    return {
      shareId,
      publicUrl: this.getPublicUrl(shareId),
      embedUrl: this.getEmbedUrl(shareId),
      embedHtml: this.getEmbedHtml(shareId),
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'published',
    };
  }
}

class ImportingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];

  constructor(private readonly project: ProjectDocument) {}

  importProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(this.project);
  }

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }
}

class RemoteMirrorImportingProjectRepository implements ProjectRepository {
  importedFilePaths: string[] = [];

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(): Promise<void> {
    return Promise.resolve();
  }

  async importMirrorFiles(files: MirrorFile[]): Promise<ProjectDocument> {
    this.importedFilePaths = files.map((file) => file.path);
    const projectFile = files.find((file) => file.path === 'project.json');
    if (!projectFile) throw new Error('Missing project.json');
    return JSON.parse(await projectFile.blob.text()) as ProjectDocument;
  }
}

class DeferredLoadingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];
  private resolveLoad: ((project: ProjectDocument | null) => void) | undefined;

  loadProject(): Promise<ProjectDocument | null> {
    return new Promise((resolve) => {
      this.resolveLoad = resolve;
    });
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }

  resolveLoadedProject(project: ProjectDocument | null) {
    this.resolveLoad?.(project);
  }
}

function enableSyncedSharing(services: ReturnType<typeof createRealAppServices>) {
  services.mirrorService = new RecordingMirrorService();
  services.shareService = new RecordingShareService();
  services.projectRepository = new LoadingProjectRepository(sampleProject.createSampleProject());
  services.persistenceAvailable = true;
  services.skipStoredProjectLoad = false;
}

export const editorShellPersistenceFixtures = {
  DeferredLoadingProjectRepository,
  ImportingProjectRepository,
  LoadingProjectRepository,
  RecordingMirrorService,
  RecordingShareService,
  RejectingLoadProjectRepository,
  RejectingProjectRepository,
  RemoteMirrorImportingProjectRepository,
  SavingProjectRepository,
  VersionHistoryProjectRepository,
  enableSyncedSharing,
  mirrorConfig,
};
