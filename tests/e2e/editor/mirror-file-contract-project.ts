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
