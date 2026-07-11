export type PresenterProtocolPreviewBatchChecksInput = {
  presenterRemoteSourceRoot: string;
  testSupportSourceRoot: string;
};

export async function evaluatePresenterProtocolPreviewBatchChecks({
  presenterRemoteSourceRoot,
  testSupportSourceRoot,
}: PresenterProtocolPreviewBatchChecksInput): Promise<Record<string, boolean>> {
  const [{ presenterRemoteProtocol }, { presenterProtocolFixture }] = (await Promise.all([
    import(`${presenterRemoteSourceRoot}/protocol.ts`),
    import(`${testSupportSourceRoot}/presenter-protocol-fixture.ts`),
  ])) as [
    typeof import('../../../packages/presenter-remote/src/protocol'),
    typeof import('./presenter-protocol-fixture'),
  ];
  const slidePreview = presenterProtocolFixture.createPreview();

  return {
    acceptsFullPreview: presenterRemoteProtocol.isPreviewBatch({
      previews: [{ id: 'page-1', name: 'Intro', preview: slidePreview }],
      requestId: 'preview-request',
      type: 'preview-batch',
    }),
    acceptsPreviewWithoutRequest: presenterRemoteProtocol.isPreviewBatch({
      previews: [{ id: 'page-1', name: 'Intro' }],
      type: 'preview-batch',
    }),
    rejectsBadPreviewElement: !presenterRemoteProtocol.isPreviewBatch({
      previews: [{ id: 'page-1', name: 'Intro', preview: { elements: [], width: 1 } }],
      type: 'preview-batch',
    }),
    rejectsBadRequestId: !presenterRemoteProtocol.isPreviewBatch({
      previews: [{ id: 'page-1', name: 'Intro' }],
      requestId: 10,
      type: 'preview-batch',
    }),
  };
}
