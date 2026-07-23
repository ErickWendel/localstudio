import { mirrorFileContractAssets } from './mirror-file-contract-assets';
import { mirrorFileContractElements } from './mirror-file-contract-elements';
import { mirrorFileContractFonts } from './mirror-file-contract-fonts';
import { mirrorFileContractPages } from './mirror-file-contract-pages';

function createProject() {
  return {
    assets: mirrorFileContractAssets.create(),
    createdAt: '2026-07-09T00:00:00.000Z',
    elements: mirrorFileContractElements.create(),
    fonts: mirrorFileContractFonts.create(),
    id: 'project-mirror-contract',
    name: 'Mirror Contract',
    pages: mirrorFileContractPages.create(),
    recordings: {
      'recording-readable': {
        audio: {
          mimeType: 'audio/webm',
          objectUrl: 'data:audio/webm;base64,bWlycm9yLWF1ZGlv',
          storage: 'inline',
        },
        createdAt: '2026-07-09T11:00:00.000Z',
        durationMs: 1500,
        id: 'recording-readable',
        name: 'Readable recording',
        segments: [],
        updatedAt: '2026-07-09T11:00:00.000Z',
      },
      'recording-unreadable': {
        audio: {
          fileName: 'kept-recording.webm',
          mimeType: 'audio/webm',
          storage: 'file',
        },
        createdAt: '2026-07-09T11:10:00.000Z',
        durationMs: 2500,
        id: 'recording-unreadable',
        name: 'Unreadable recording',
        segments: [],
        updatedAt: '2026-07-09T11:10:00.000Z',
      },
    },
    updatedAt: '2026-07-09T12:00:00.000Z',
  };
}

function createVersionProject() {
  const project = createProject();

  return {
    ...project,
    assets: {
      'asset-used': {
        ...project.assets['asset-used'],
        objectUrl: 'data:image/png;base64,dmVyc2lvbi1pbWFnZQ==',
      },
    },
    fonts: {},
    id: 'project-mirror-contract-version',
  };
}

export const mirrorFileContractProject = {
  createProject,
  createVersionProject,
};
