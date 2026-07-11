export const mirrorFileContractAssets = {
  create() {
    return {
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
    };
  },
};
