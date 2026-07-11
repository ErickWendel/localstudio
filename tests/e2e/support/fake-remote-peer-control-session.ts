export type FakeRemotePeerControlSession = {
  code: string;
  connectedControllerCount: number;
  controlPeerId: string;
  expiresAt: string;
  presenterDeviceId: string;
  presenterLabel: string;
  sessionId: string;
  transport: 'peerjs';
};

export function createFakeRemotePeerControlSession(): FakeRemotePeerControlSession {
  return {
    code: 'peer-control-1',
    connectedControllerCount: 0,
    controlPeerId: 'peer-control-1',
    expiresAt: '2026-07-10T12:01:00.000Z',
    presenterDeviceId: 'presenter-device-1',
    presenterLabel: 'Studio laptop',
    sessionId: 'peer-session-1',
    transport: 'peerjs',
  };
}
