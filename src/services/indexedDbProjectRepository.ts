import { openDB, type DBSchema } from 'idb';
import type { ProjectDocument } from '../domain/model';
import type { ProjectRepository } from './interfaces';

interface EwCanvasDb extends DBSchema {
  projects: {
    key: string;
    value: ProjectDocument;
  };
}

export class IndexedDbProjectRepository implements ProjectRepository {
  constructor(private readonly dbName = 'ew-canvas-ai') {}

  private async db() {
    return openDB<EwCanvasDb>(this.dbName, 1, {
      upgrade(database) {
        database.createObjectStore('projects');
      },
    });
  }

  async loadProject(): Promise<ProjectDocument | null> {
    const db = await this.db();
    return (await db.get('projects', 'current')) ?? null;
  }

  async saveProject(project: ProjectDocument): Promise<void> {
    const db = await this.db();
    await db.put('projects', project, 'current');
  }
}
