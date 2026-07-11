import type { ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export const remoteMirrorImportProject = {
  create(): ProjectDocument {
    const now = '2026-07-07T00:00:00.000Z';
    return {
      assets: {},
      createdAt: now,
      elements: {
        'remote-title': {
          align: 'center',
          fill: '#37FD76',
          fontFamily: 'Open Sans',
          fontSize: 76,
          fontWeight: 800,
          height: 140,
          id: 'remote-title',
          locked: false,
          opacity: 1,
          rotation: 0,
          text: 'Imported from remote mirror',
          type: 'text',
          visible: true,
          width: 1200,
          x: 360,
          y: 360,
        },
      },
      id: 'project-remote-import',
      name: 'Remote Mirror Deck',
      pages: [
        {
          background: { color: '#050D10', type: 'color' },
          elementIds: ['remote-title'],
          height: 1080,
          id: 'remote-page-1',
          name: 'Remote Slide',
          width: 1920,
        },
      ],
      updatedAt: now,
    };
  },
};
