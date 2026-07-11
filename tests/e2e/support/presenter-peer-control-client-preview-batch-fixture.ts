export function createPresenterPeerControlClientPreviewBatch() {
  return {
    previews: [{ id: 'slide-1', name: 'Intro' }],
    requestId: 'client-preview-request',
    type: 'preview-batch',
  };
}
