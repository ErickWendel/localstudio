import { describe, expect, it } from 'vitest';
import type { TranscriptRecording } from '../../../../src/domain/documents/model';
import { recordingRemovalCommands } from '../../../../src/domain/commands/recordings/recording-removal-commands';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';

function createRecording(id: string, name: string): TranscriptRecording {
  return {
    id,
    name,
    createdAt: '2026-09-19T12:00:00.000Z',
    updatedAt: '2026-09-19T12:00:00.000Z',
    durationMs: 1_000,
    modelPresetId: 'web-speech-api',
    audio: {
      mimeType: 'audio/webm',
      fileName: `${id}.webm`,
      objectUrl: `blob:https://localstudio.test/${id}`,
      storage: 'file',
    },
    transcriptFileName: `${id}.transcript.json`,
    segments: [{ id: `${id}-segment`, text: 'Hello', startMs: 0, endMs: 1_000, final: true }],
  };
}

describe('recording removal commands', () => {
  it('removes a recording without changing the source project', () => {
    const project = sampleProject.createSampleProject();
    const recording = createRecording('recording-1', 'Launch talk');
    const otherRecording = createRecording('recording-2', 'Rehearsal');
    project.recordings = {
      [recording.id]: recording,
      [otherRecording.id]: otherRecording,
    };

    const next = new recordingRemovalCommands.RemoveRecordingCommand(recording.id).execute(project);

    expect(next.recordings?.[recording.id]).toBeUndefined();
    expect(next.recordings?.[otherRecording.id]).toEqual(otherRecording);
    expect(project.recordings[recording.id]).toEqual(recording);
  });

  it('drops the recordings collection when the last recording is removed', () => {
    const project = {
      ...sampleProject.createSampleProject(),
      recordings: {
        'recording-1': createRecording('recording-1', 'Launch talk'),
      },
    };

    const next = new recordingRemovalCommands.RemoveRecordingCommand('recording-1').execute(project);

    expect(next).not.toHaveProperty('recordings');
  });

  it('leaves the project unchanged when the recording is missing', () => {
    const project = sampleProject.createSampleProject();

    expect(new recordingRemovalCommands.RemoveRecordingCommand('missing').execute(project)).toBe(
      project,
    );
  });

  it('removes only the transcript and keeps the recording audio', () => {
    const project = sampleProject.createSampleProject();
    const recording = createRecording('recording-1', 'Launch talk');
    project.recordings = { [recording.id]: recording };

    const next = new recordingRemovalCommands.RemoveTranscriptCommand(recording.id).execute(
      project,
    );
    const nextRecording = next.recordings?.[recording.id];

    expect(nextRecording?.audio).toEqual(recording.audio);
    expect(nextRecording?.segments).toEqual([]);
    expect(nextRecording).not.toHaveProperty('transcriptFileName');
    expect(project.recordings[recording.id]?.segments).toEqual(recording.segments);
  });

  it('removes only the audio and keeps the transcript', () => {
    const project = sampleProject.createSampleProject();
    const recording = createRecording('recording-1', 'Launch talk');
    project.recordings = { [recording.id]: recording };

    const next = new recordingRemovalCommands.RemoveRecordingAudioCommand(recording.id).execute(
      project,
    );
    const nextRecording = next.recordings?.[recording.id];

    expect(nextRecording?.audio).toEqual({ mimeType: recording.audio.mimeType });
    expect(nextRecording?.segments).toEqual(recording.segments);
    expect(nextRecording?.transcriptFileName).toBe(recording.transcriptFileName);
    expect(project.recordings[recording.id]?.audio).toEqual(recording.audio);
  });

  it('removes the recording when its audio is deleted and no transcript remains', () => {
    const project = sampleProject.createSampleProject();
    const recording = createRecording('recording-1', 'Launch talk');
    delete recording.transcriptFileName;
    recording.segments = [];
    project.recordings = { [recording.id]: recording };

    const next = new recordingRemovalCommands.RemoveRecordingAudioCommand(recording.id).execute(
      project,
    );

    expect(next).not.toHaveProperty('recordings');
    expect(project.recordings[recording.id]).toEqual(recording);
  });

  it('leaves a recording unchanged when it has no audio', () => {
    const project = sampleProject.createSampleProject();
    const recording = createRecording('recording-1', 'Launch talk');
    recording.audio = { mimeType: recording.audio.mimeType };
    project.recordings = { [recording.id]: recording };

    expect(
      new recordingRemovalCommands.RemoveRecordingAudioCommand(recording.id).execute(project),
    ).toBe(project);
  });

  it('leaves a recording unchanged when it has no transcript', () => {
    const project = sampleProject.createSampleProject();
    const recording = createRecording('recording-1', 'Launch talk');
    delete recording.transcriptFileName;
    recording.segments = [];
    project.recordings = { [recording.id]: recording };

    expect(new recordingRemovalCommands.RemoveTranscriptCommand(recording.id).execute(project)).toBe(
      project,
    );
  });
});
