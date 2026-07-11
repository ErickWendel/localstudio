export type PresenterProtocolStreamPreferenceChecksInput = {
  presenterRemoteSourceRoot: string;
};

export async function evaluatePresenterProtocolStreamPreferenceChecks({
  presenterRemoteSourceRoot,
}: PresenterProtocolStreamPreferenceChecksInput): Promise<Record<string, boolean>> {
  const { presenterRemoteProtocol } = (await import(
    `${presenterRemoteSourceRoot}/protocol.ts`
  )) as typeof import('../../../packages/presenter-remote/src/protocol');

  return {
    acceptsAuto: presenterRemoteProtocol.isStreamPreference({
      fps: 30,
      height: 720,
      quality: 'auto',
      type: 'stream-preference',
      width: 1280,
    }),
    acceptsMedium: presenterRemoteProtocol.isStreamPreference({
      fps: 30,
      height: 720,
      quality: 'medium',
      type: 'stream-preference',
      width: 1280,
    }),
    rejectsBadQuality: !presenterRemoteProtocol.isStreamPreference({
      fps: 30,
      height: 720,
      quality: 'best',
      type: 'stream-preference',
      width: 1280,
    }),
    rejectsZeroDimensions: !presenterRemoteProtocol.isStreamPreference({
      fps: 0,
      height: 0,
      quality: 'low',
      type: 'stream-preference',
      width: 0,
    }),
  };
}
