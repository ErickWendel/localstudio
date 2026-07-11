import { joystickTrustedPresenterRemote } from './joystick-trusted-presenter-remote';
import { joystickTrustedPresenterSession } from './joystick-trusted-presenter-session';
import { joystickTrustedPresenterState } from './joystick-trusted-presenter-state';

export const joystickTrustedPresenterHarness = {
  createRemoteState: (presenterMode: Parameters<typeof joystickTrustedPresenterState.create>[0]) =>
    joystickTrustedPresenterState.create(presenterMode),
  createSession: (config: Parameters<typeof joystickTrustedPresenterSession.create>[0]) =>
    joystickTrustedPresenterSession.create(config),
  installTrustedPresenterRemote: (
    page: Parameters<typeof joystickTrustedPresenterRemote.install>[0],
    config: Parameters<typeof joystickTrustedPresenterRemote.install>[1],
  ) => joystickTrustedPresenterRemote.install(page, config),
};
