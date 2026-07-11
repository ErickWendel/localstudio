export function createPresenterPeerControlHostPreviewBatch() {
  return {
    previews: [{ pageId: 'slide-1', preview: 'data:image/png;base64,AA==' }],
    requestId: 'preview-request-1',
    type: 'preview-batch',
  };
}
