import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { duplicateProjectDocument } from '../../../../src/domain/projects/duplicateProjectDocument';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';

describe('duplicateProjectDocument', () => {
  it('creates a new project without recordings or transcripts', () => {
    const project: ProjectDocument = {
      ...sampleProject.createSampleProject(),
      recordings: {
        recording1: {
          id: 'recording1',
          name: 'Presenter recording',
          createdAt: '2026-09-19T12:00:00.000Z',
          updatedAt: '2026-09-19T12:00:00.000Z',
          durationMs: 1_000,
          modelPresetId: 'web-speech-api',
          audio: { mimeType: 'audio/webm', storage: 'inline' },
          segments: [
            { id: 'segment1', text: 'Private transcript', startMs: 0, endMs: 1_000, final: true },
          ],
        },
      },
    };

    const duplicate = duplicateProjectDocument(project, {
      createId: () => 'project-copy',
      name: 'Launch Deck Copy',
      now: () => '2026-09-23T18:00:00.000Z',
    });

    expect(duplicate).toMatchObject({
      id: 'project-copy',
      name: 'Launch Deck Copy',
      createdAt: '2026-09-23T18:00:00.000Z',
      updatedAt: '2026-09-23T18:00:00.000Z',
    });
    expect(duplicate).not.toHaveProperty('recordings');
    expect(project.recordings?.recording1?.segments[0]?.text).toBe('Private transcript');
  });
});
