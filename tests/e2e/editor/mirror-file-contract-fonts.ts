export const mirrorFileContractFonts = {
  create() {
    return {
      inter: {
        family: 'Inter',
        fileName: 'inter.woff2',
        id: 'inter',
        objectUrl: 'data:font/woff2;base64,bWlycm9yLWZvbnQ=',
        storage: 'browser',
      },
      fallback: {
        family: 'Fallback Sans',
        fileName: 'fallback.woff2',
        id: 'fallback',
        storage: 'file',
      },
    };
  },
};
