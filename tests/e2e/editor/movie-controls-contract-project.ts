import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export const movieControlsContractProject = {
  createProject(): ProjectDocument {
    return {
      assets: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      elements: {
        'video-1': {
          assetId: 'asset-video',
          height: 100,
          id: 'video-1',
          locked: false,
          opacity: 1,
          rotation: 0,
          trimStartSeconds: 2,
          type: 'video',
          visible: true,
          width: 100,
          x: 0,
          y: 0,
        },
      },
      fonts: {},
      id: 'movie-project',
      name: 'Movie Contract',
      pages: [
        {
          animationBuilds: [
            {
              delayMs: 0,
              effect: 'reveal',
              elementId: 'video-1',
              id: 'movie-build',
              mediaAction: 'play',
              trigger: 'on-click',
            },
          ],
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['video-1'],
          height: 1080,
          id: 'page-video',
          name: 'Video',
          visible: true,
          width: 1920,
        },
      ],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  },
};
