import type {
  PresenterRemoteCommand,
  PresenterRemoteSession,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';

export type E2EJoystickRemote = {
  commands: string[];
  setPresenterMode: (presenterMode: PresenterRemoteState['presenterMode']) => void;
};

export interface JoystickTrustedPresenterInstallConfig {
  initialState: PresenterRemoteState;
  sessions: PresenterRemoteSession[];
}

declare global {
  interface Window {
    __LOCALSTUDIO_E2E_JOYSTICK__?: E2EJoystickRemote | undefined;
    __LOCALSTUDIO_JOYSTICK_SIGNALING_SERVICE__?:
      | {
          connectController?: (code: string) => PresenterRemoteSession | undefined;
          getPublishedState?: () => PresenterRemoteState;
          listSessions?: () => PresenterRemoteSession[];
          lookupSession: (code: string) => PresenterRemoteSession | undefined;
          publishCommand: (
            code: string,
            command: PresenterRemoteCommand,
            controllerId?: string,
          ) => boolean;
        }
      | undefined;
  }
}
