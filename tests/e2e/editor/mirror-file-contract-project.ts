function createProject() {
  return {
    assets: {
      'asset-used': {
        id: 'asset-used',
        mimeType: 'image/png',
        name: 'Used image',
        objectUrl: 'data:image/png;base64,bWlycm9yLWltYWdl',
        type: 'image',
      },
      'asset-unused': {
        id: 'asset-unused',
        mimeType: 'image/png',
        name: 'Unused image',
        objectUrl: 'data:image/png;base64,dW51c2Vk',
        type: 'image',
      },
      'asset-unreadable': {
        id: 'asset-unreadable',
        mimeType: 'image/png',
        name: 'Unreadable image',
        objectUrl: 'https://example.test/unreadable.png',
        type: 'image',
      },
    },
    createdAt: '2026-07-09T00:00:00.000Z',
    elements: {
      'image-1': {
        assetId: 'asset-used',
        height: 100,
        id: 'image-1',
        locked: false,
        opacity: 1,
        rotation: 0,
        type: 'image',
        visible: true,
        width: 100,
        x: 0,
        y: 0,
      },
      'image-2': {
        assetId: 'asset-unreadable',
        height: 120,
        id: 'image-2',
        locked: false,
        opacity: 1,
        rotation: 0,
        type: 'image',
        visible: true,
        width: 120,
        x: 120,
        y: 0,
      },
    },
    fonts: {
      inter: {
        family: 'Inter',
        fileName: 'inter.woff2',
        id: 'inter',
        objectUrl: 'data:font/woff2;base64,bWlycm9yLWZvbnQ=',
        storage: 'browser',
      },
    },
    id: 'project-mirror-contract',
    name: 'Mirror Contract',
    pages: [
      {
        background: { color: '#ffffff', type: 'color' },
        elementIds: ['image-1', 'image-2'],
        height: 1080,
        id: 'page-1',
        name: 'Slide 1',
        visible: true,
        width: 1920,
      },
    ],
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
