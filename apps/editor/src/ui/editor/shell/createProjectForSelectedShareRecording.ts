import type { ProjectDocument } from '../../../domain/documents/model';

export function createProjectForSelectedShareRecording(
  project: ProjectDocument,
  selectedRecordingId?: string,
): ProjectDocument {
  if (!selectedRecordingId) return project;
  const selectedRecording = project.recordings?.[selectedRecordingId];
  if (!selectedRecording) return project;
  return {
    ...project,
    recordings: {
      [selectedRecordingId]: selectedRecording,
    },
  };
}
