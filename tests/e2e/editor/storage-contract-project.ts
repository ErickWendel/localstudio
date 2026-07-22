export function createStorageContractProject() {
  const dataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM=';
  const fontUrl = 'data:font/woff2;base64,Zm9udC1ieXRlcw==';
  const recordingUrl = 'data:audio/webm;base64,YXVkaW8tYnl0ZXM=';

  return {
    assets: {
      'asset-kept': {
        id: 'asset-kept',
        mimeType: 'image/png',
        name: 'Kept image',
        objectUrl: dataUrl,
        type: 'image',
      },
      'asset-file-backed': {
        fileName: 'asset-file-backed.png',
        id: 'asset-file-backed',
        mimeType: 'image/png',
        name: 'Already on disk',
        objectUrl: 'blob:stale-file-backed-image',
        storage: 'file',
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
      archived: {
        family: 'Archived Sans',
        fileName: 'archived.woff2',
        id: 'archived',
        mimeType: 'font/woff2',
        objectUrl: 'blob:stale-font',
        storage: 'file',
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
    recordings: {
      'recording-file-backed': {
        audio: {
          fileName: 'recording-file-backed.webm',
          mimeType: 'audio/webm',
          objectUrl: 'blob:stale-recording',
          storage: 'file',
        },
        createdAt: '2026-07-09T00:00:00.000Z',
        durationMs: 1000,
        id: 'recording-file-backed',
        name: 'Existing recording',
        segments: [],
        updatedAt: '2026-07-09T00:00:00.000Z',
      },
      'recording-inline': {
        audio: {
          mimeType: 'audio/webm',
          objectUrl: recordingUrl,
          storage: 'inline',
        },
        createdAt: '2026-07-09T00:00:00.000Z',
        durationMs: 2000,
        id: 'recording-inline',
        name: 'Inline recording',
        segments: [],
        updatedAt: '2026-07-09T00:00:00.000Z',
      },
    },
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
