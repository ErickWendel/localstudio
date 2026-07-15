import {
  type PresenterRemoteCommand,
  type PresenterRemoteSlidePreview,
  type PresenterRemoteState,
} from '../../../packages/presenter-remote/src/protocol';

export type PresenterProtocolValidatorContractInput = {
  commands: PresenterRemoteCommand[];
  presenterRemoteSourceRoot: string;
  preview: PresenterRemoteSlidePreview;
  state: PresenterRemoteState;
};

export type PresenterProtocolValidatorContractResult = {
  commandResults: boolean[];
  invalidCommand: boolean;
  invalidPreviewBatch: boolean;
  invalidSession: boolean;
  invalidState: boolean;
  previewBatch: boolean;
  session: boolean;
  state: boolean;
};

export async function evaluatePresenterProtocolValidatorContract({
  commands,
  presenterRemoteSourceRoot,
  preview,
  state,
}: PresenterProtocolValidatorContractInput): Promise<PresenterProtocolValidatorContractResult> {
  const { presenterRemoteProtocol } = (await import(
    `${presenterRemoteSourceRoot}/protocol.ts`
  )) as typeof import('../../../packages/presenter-remote/src/protocol');

  return {
    commandResults: commands.map((command) => presenterRemoteProtocol.isCommand(command)),
    invalidCommand: presenterRemoteProtocol.isCommand({
      command: 'go-to-page',
      type: 'command',
    }),
    invalidPreviewBatch: presenterRemoteProtocol.isPreviewBatch({
      previews: [{ id: 'bad' }],
      type: 'preview-batch',
    }),
    invalidSession: presenterRemoteProtocol.isSession({ code: 'ABCD-1234' }),
    invalidState: presenterRemoteProtocol.isState({ ...state, timer: { paused: false } }),
    previewBatch: presenterRemoteProtocol.isPreviewBatch({
      previews: [{ id: 'page-1', name: 'Intro', preview }],
      requestId: 'request-1',
      type: 'preview-batch',
    }),
    session: presenterRemoteProtocol.isSession({
      code: 'ABCD-1234',
      connectedControllerCount: 1,
      expiresAt: '2026-07-09T12:00:00.000Z',
      presenterDeviceId: 'presenter',
      presenterLabel: 'Stage',
      sessionId: 'session-1',
    }),
    state: presenterRemoteProtocol.isState(state),
  };
}
