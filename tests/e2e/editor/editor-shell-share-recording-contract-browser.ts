/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type EditorShellShareRecordingContractInput = {
  editorSourceRoot: string;
};

export async function evaluateEditorShellShareRecordingContract({
  editorSourceRoot,
}: EditorShellShareRecordingContractInput) {
  const { createProjectForSelectedShareRecording } = (await import(
    `${editorSourceRoot}/ui/editor/shell/createProjectForSelectedShareRecording.ts`
  )) as typeof import('../../../apps/editor/src/ui/editor/shell/createProjectForSelectedShareRecording');

  const project = {
    id: 'share-recording-contract-project',
    name: 'Share recording contract',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    assets: {},
    elements: {},
    pages: [],
    recordings: {
      first: {
        id: 'first',
        name: 'First take',
        createdAt: '2026-07-20T00:00:00.000Z',
        updatedAt: '2026-07-20T00:00:00.000Z',
        durationMs: 1_000,
        language: 'en-US',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'blob:http://localhost/first',
          storage: 'inline',
        },
        segments: [],
      },
      second: {
        id: 'second',
        name: 'Second take',
        createdAt: '2026-07-20T00:01:00.000Z',
        updatedAt: '2026-07-20T00:01:00.000Z',
        durationMs: 2_000,
        language: 'en-US',
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'blob:http://localhost/second',
          storage: 'inline',
        },
        segments: [],
      },
    },
  } satisfies ProjectDocument;

  return {
    missingSelectionKeepsAll: Object.keys(
      createProjectForSelectedShareRecording(project, 'missing').recordings ?? {},
    ),
    noSelectionKeepsIdentity: createProjectForSelectedShareRecording(project) === project,
    selectedRecordingIds: Object.keys(
      createProjectForSelectedShareRecording(project, 'second').recordings ?? {},
    ),
  };
}
