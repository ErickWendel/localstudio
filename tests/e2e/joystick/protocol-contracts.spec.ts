import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { joystickSignalingContractRuntime } from './joystick-signaling-contract-runtime';
import { evaluateJoystickProtocolContract } from './protocol-contract-browser';

const getServer = withIsolatedDevServer(test);

test('executes joystick protocol and session code contracts in the browser runtime', async ({
  page,
}) => {
  await joystickSignalingContractRuntime.gotoReady(page, getServer().baseURL);

  const result = await page.evaluate(evaluateJoystickProtocolContract, {
    sourceRoot: joystickSignalingContractRuntime.presenterRemoteSourceRoot,
    testSupportSourceRoot: joystickSignalingContractRuntime.testSupportSourceRoot,
  });

  expect(result.commandChecks).toEqual({
    acceptsClose: true,
    acceptsGoToPage: true,
    acceptsRequestPreviews: true,
    acceptsUpdateNotes: true,
    rejectsBadPageId: true,
    rejectsBadPreviewRequest: true,
    rejectsUnknownCommand: true,
  });
  expect(result.previewBatchChecks).toEqual({
    acceptsFullPreview: true,
    acceptsPreviewWithoutRequest: true,
    rejectsBadPreviewElement: true,
    rejectsBadRequestId: true,
  });
  expect(result.sessionChecks).toEqual({
    acceptsSession: true,
    rejectsMissingSessionId: true,
  });
  expect(result.sessionCodeChecks).toEqual({
    createdFallback: true,
    normalizedShort: 'AB12',
    normalizedSpaced: 'AB12-CD34',
    rejectsInvalid: true,
    validatesNormalized: true,
  });
  expect(result.stateChecks).toEqual({
    acceptsFullState: true,
    acceptsReadyState: true,
    rejectsBadBuilds: true,
    rejectsBadPreviewMode: true,
    rejectsBadStream: true,
    rejectsMissingTimer: true,
  });
});
