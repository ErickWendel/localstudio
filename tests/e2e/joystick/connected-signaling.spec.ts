import { test, withIsolatedDevServer } from '../support/journey-test';
import { connectedPeerControls } from './connected-peer-controls';
import { connectedPeerDiagnostics } from './connected-peer-diagnostics';
import { connectedPeerEditorDeck } from './connected-peer-editor-deck';
import { connectedPeerPairing } from './connected-peer-pairing';

const getServer = withIsolatedDevServer(test);

test.describe('joystick connected peer journey', () => {
  test('pairs with the real presenter PeerJS session and controls the presenter view', async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const diagnostics = connectedPeerDiagnostics.create();
    page.on('console', diagnostics.capture('editor console'));
    page.on('pageerror', (error) => diagnostics.push(`editor pageerror: ${error.message}`));
    await connectedPeerPairing.installClipboardCapture(page);

    await connectedPeerEditorDeck.create(page, getServer().baseURL);
    const presenterPage = await connectedPeerPairing.openPresenterView(page);

    const joystickPage = await connectedPeerPairing.connectRemote(
      context,
      page,
      presenterPage,
      getServer().baseURL,
    );
    joystickPage.on('console', diagnostics.capture('joystick console'));
    joystickPage.on('pageerror', (error) => diagnostics.push(`joystick pageerror: ${error.message}`));

    await connectedPeerControls.assertInitialState(joystickPage);
    await connectedPeerControls.exerciseTimer(joystickPage);
    await connectedPeerControls.exerciseSlideButtons(joystickPage, presenterPage);
    await connectedPeerControls.resizePresenterNotes(joystickPage);
    await connectedPeerControls.exerciseStreamGestures(joystickPage, presenterPage);
    await connectedPeerControls.exerciseSlideNavigation(joystickPage, presenterPage);
    await connectedPeerControls.verifyReloadReconnect(joystickPage, presenterPage);
    await diagnostics.attach(testInfo);
  });
});
