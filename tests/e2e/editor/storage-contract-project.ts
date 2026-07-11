export function createStorageContractProject() {
  const dataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM=';
  const fontUrl = 'data:font/woff2;base64,Zm9udC1ieXRlcw==';

  return {
    assets: {
      'asset-kept': {
        id: 'asset-kept',
        mimeType: 'image/png',
        name: 'Kept image',
        objectUrl: dataUrl,
        type: 'image',
      },
    },
    createdAt: '2026-07-09T00:00:00.000Z',
    elements: {
      'image-1': {
        assetId: 'asset-kept',
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
    },
    fonts: {
      inter: {
        family: 'Inter',
        fileName: 'inter.woff2',
        id: 'inter',
        objectUrl: fontUrl,
        storage: 'browser',
      },
    },
    id: 'project-file-contract',
    name: 'File Contract',
    pages: [
      {
        background: { color: '#ffffff', type: 'color' },
        elementIds: ['image-1'],
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

export function createMirrorStorageContractProject() {
  return {
    ...createStorageContractProject(),
    assets: {
      'asset-kept': {
        fileName: 'asset-kept.png',
        id: 'asset-kept',
        mimeType: 'image/png',
        name: 'Kept image',
        storage: 'file',
        type: 'image',
      },
    },
    fonts: {},
    name: 'Mirrored Contract',
  };
}
