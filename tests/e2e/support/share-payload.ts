import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';
import { createSharePayloadProject } from './share-payload-project';

interface E2ESharePayload {
  schemaVersion: number;
  shareId: string;
  createdAt: string;
  updatedAt: string;
  project: ProjectDocument;
}

export function createSharePayload(): E2ESharePayload {
  const now = '2026-07-06T00:00:00.000Z';
  return {
    schemaVersion: 1,
    shareId: 'e2e-share',
    createdAt: now,
    updatedAt: now,
    project: createSharePayloadProject(now),
  };
}
