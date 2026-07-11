export type PresenterProtocolStateChecksInput = {
  presenterRemoteSourceRoot: string;
  testSupportSourceRoot: string;
};

export async function evaluatePresenterProtocolStateChecks({
  presenterRemoteSourceRoot,
  testSupportSourceRoot,
}: PresenterProtocolStateChecksInput): Promise<Record<string, boolean>> {
  const [{ presenterRemoteProtocol }, { presenterProtocolFixture }] = (await Promise.all([
    import(`${presenterRemoteSourceRoot}/protocol.ts`),
    import(`${testSupportSourceRoot}/presenter-protocol-fixture.ts`),
  ])) as [
    typeof import('../../../packages/presenter-remote/src/protocol'),
    typeof import('./presenter-protocol-fixture'),
  ];
  const state = presenterProtocolFixture.createState();

  return {
    acceptsFullState: presenterRemoteProtocol.isState(state),
    acceptsReadyState: presenterRemoteProtocol.isState({
      ...state,
      nextSlidePreview: undefined,
      previewMode: 'stream',
      presenterMode: 'ready',
      slidePreview: undefined,
      stream: undefined,
      upcomingSlidePreviews: undefined,
    }),
    rejectsBadBuilds: !presenterRemoteProtocol.isState({
      ...state,
      builds: { current: '1', remaining: 2, total: 3 },
    }),
    rejectsBadPreviewMode: !presenterRemoteProtocol.isState({
      ...state,
      previewMode: 'thumbnail',
    }),
    rejectsBadStream: !presenterRemoteProtocol.isState({
      ...state,
      stream: { enabled: true, fps: 30, height: 720, transport: 'webrtc', width: 1280 },
    }),
    rejectsMissingTimer: !presenterRemoteProtocol.isState({
      ...state,
      timer: undefined,
    }),
  };
}
