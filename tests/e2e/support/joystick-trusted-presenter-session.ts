import type { PresenterRemoteSession } from '@localstudio/presenter-remote/protocol';

interface CreateJoystickTrustedPresenterSessionInput {
  code: string;
  expiresAt: string;
  presenterDeviceId: string;
  presenterLabel: string;
}

export const joystickTrustedPresenterSession = {
  create({
    code,
    expiresAt,
    presenterDeviceId,
    presenterLabel,
  }: CreateJoystickTrustedPresenterSessionInput): PresenterRemoteSession {
    return {
      code,
      connectedControllerCount: 1,
      expiresAt,
      presenterDeviceId,
      presenterLabel,
      sessionId: `session-${code}`,
    };
  },
};
