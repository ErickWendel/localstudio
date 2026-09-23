import type { ProjectDocument } from '../documents/model';

interface DuplicateProjectDocumentOptions {
  createId: () => string;
  name: string;
  now: () => string;
}

export function duplicateProjectDocument(
  project: ProjectDocument,
  options: DuplicateProjectDocumentOptions,
): ProjectDocument {
  const timestamp = options.now();
  const duplicate = { ...project };
  delete duplicate.recordings;

  return {
    ...duplicate,
    id: options.createId(),
    name: options.name,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
