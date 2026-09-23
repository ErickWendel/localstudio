import type { ProjectDocument } from '../../domain/documents/model';
import { sampleProject } from '../../domain/projects/sampleProject';

export function createE2eAssetFixtureProject(): ProjectDocument {
  const project = sampleProject.createBlankProject();
  const now = project.createdAt;
  const unusedAssetUrl = URL.createObjectURL(new Blob(['unused'], { type: 'image/png' }));
  const usedAssetUrl = URL.createObjectURL(new Blob(['used'], { type: 'image/png' }));
  const recordingUrl = URL.createObjectURL(new Blob(['recording'], { type: 'audio/webm' }));

  return {
    ...project,
    assets: {
      'asset-unused': {
        id: 'asset-unused',
        type: 'image',
        name: 'Unused fixture.png',
        mimeType: 'image/png',
        objectUrl: unusedAssetUrl,
        storage: 'inline',
      },
      'asset-used': {
        id: 'asset-used',
        type: 'image',
        name: 'Used fixture.png',
        mimeType: 'image/png',
        objectUrl: usedAssetUrl,
        storage: 'inline',
      },
    },
    elements: {
      'image-used': {
        id: 'image-used',
        type: 'image',
        assetId: 'asset-used',
        x: 80,
        y: 80,
        width: 320,
        height: 180,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
      },
    },
    pages: project.pages.map((page) => ({
      ...page,
      elementIds: ['image-used'],
    })),
    recordings: {
      'recording-1': {
        id: 'recording-1',
        name: 'Launch talk',
        createdAt: now,
        updatedAt: now,
        durationMs: 65_000,
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm',
          fileName: 'launch.webm',
          objectUrl: recordingUrl,
          storage: 'inline',
        },
        transcriptFileName: 'recording-1.transcript.json',
        segments: [
          {
            id: 'segment-1',
            text: 'Hello from the fixture',
            startMs: 0,
            endMs: 1_000,
            final: true,
            ...(project.pages[0] ? { pageId: project.pages[0].id } : {}),
          },
        ],
      },
      'recording-2': {
        id: 'recording-2',
        name: 'Rehearsal',
        createdAt: now,
        updatedAt: now,
        durationMs: 12_000,
        modelPresetId: 'web-speech-api',
        audio: {
          mimeType: 'audio/webm',
          fileName: 'rehearsal.webm',
          objectUrl: recordingUrl,
          storage: 'inline',
        },
        segments: [],
      },
    },
  };
}
