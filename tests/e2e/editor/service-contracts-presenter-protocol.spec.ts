import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { presenterProtocolCommandFixture } from './presenter-protocol-command-fixture';
import { presenterProtocolPreviewFixture } from './presenter-protocol-preview-fixture';
import { presenterProtocolStateFixture } from './presenter-protocol-state-fixture';
import { serviceContractsSupport } from './service-contracts-support';

test('executes presenter protocol validator contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(
    async ({ commands, presenterRemoteSourceRoot, preview, state }) => {
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
        invalidStreamPreference: presenterRemoteProtocol.isStreamPreference({
          fps: 0,
          height: 720,
          quality: 'ultra',
          type: 'stream-preference',
          width: 1280,
        }),
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
        streamPreference: presenterRemoteProtocol.isStreamPreference({
          fps: 30,
          height: 720,
          quality: 'medium',
          type: 'stream-preference',
          width: 1280,
        }),
      };
    },
    {
      commands: presenterProtocolCommandFixture.createCommands(),
      presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
      preview: presenterProtocolPreviewFixture.createPreview(),
      state: presenterProtocolStateFixture.createState(),
    },
  );

  expect(result).toMatchObject({
    invalidCommand: false,
    invalidPreviewBatch: false,
    invalidSession: false,
    invalidState: false,
    invalidStreamPreference: false,
    previewBatch: true,
    session: true,
    state: true,
    streamPreference: true,
  });
  expect(result.commandResults).toEqual(serviceContractsSupport.commandsAllTrue);
});
