import type { ProjectDocument, TranscriptRecording } from '../../documents/model';
import { projectMutationUtils } from '../shared/projectMutationUtils';
import type { EditorCommand } from '../shared/types';

function hasRecordingAudio(recording: TranscriptRecording) {
  return Boolean(
    recording.audio.fileName || recording.audio.objectUrl || recording.audio.storage === 'file',
  );
}

function hasTranscript(recording: TranscriptRecording) {
  return recording.segments.length > 0 || Boolean(recording.transcriptFileName);
}

function withoutRecording(project: ProjectDocument, recordingId: string): ProjectDocument {
  const recordings = { ...project.recordings };
  delete recordings[recordingId];
  const projectWithoutRecordings = { ...project };
  delete projectWithoutRecordings.recordings;

  return {
    ...projectWithoutRecordings,
    ...(Object.keys(recordings).length > 0 ? { recordings } : {}),
    updatedAt: projectMutationUtils.getProjectUpdatedAt(),
  };
}

class RemoveRecordingCommand implements EditorCommand {
  readonly description = 'Remove recording';

  constructor(private readonly recordingId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    if (!project.recordings?.[this.recordingId]) return project;
    return withoutRecording(project, this.recordingId);
  }
}

class RemoveRecordingAudioCommand implements EditorCommand {
  readonly description = 'Remove recording audio';

  constructor(private readonly recordingId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    const recording = project.recordings?.[this.recordingId];
    if (!recording || !hasRecordingAudio(recording)) return project;
    if (!hasTranscript(recording)) return withoutRecording(project, this.recordingId);

    return {
      ...project,
      recordings: {
        ...project.recordings,
        [this.recordingId]: {
          ...recording,
          audio: { mimeType: recording.audio.mimeType },
          updatedAt: projectMutationUtils.getProjectUpdatedAt(),
        },
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

class RemoveTranscriptCommand implements EditorCommand {
  readonly description = 'Remove transcript';

  constructor(private readonly recordingId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    const recording = project.recordings?.[this.recordingId];
    if (!recording || !hasTranscript(recording)) return project;
    if (!hasRecordingAudio(recording)) return withoutRecording(project, this.recordingId);

    const recordingWithoutTranscript = {
      ...recording,
      segments: [],
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
    delete recordingWithoutTranscript.transcriptFileName;

    return {
      ...project,
      recordings: {
        ...project.recordings,
        [this.recordingId]: recordingWithoutTranscript,
      },
      updatedAt: projectMutationUtils.getProjectUpdatedAt(),
    };
  }
}

export const recordingRemovalCommands = {
  RemoveRecordingAudioCommand,
  RemoveRecordingCommand,
  RemoveTranscriptCommand,
};
