export const commandContractAssets = {
  create() {
    return {
      'asset-image': {
        id: 'asset-image',
        mimeType: 'image/png',
        name: 'Image',
        objectUrl: 'data:image/png;base64,AA==',
        type: 'image',
      },
      'asset-video': {
        id: 'asset-video',
        mimeType: 'video/mp4',
        name: 'Video',
        objectUrl: 'data:video/mp4;base64,AA==',
        type: 'video',
      },
    };
  },
};
