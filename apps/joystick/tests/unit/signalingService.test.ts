import { describe, expect, it } from 'vitest';
import { InMemoryPresenterRemoteSignalingService } from '@localstudio/presenter-remote/signaling-service';

describe('InMemoryPresenterRemoteSignalingService', () => {
  it('lists exactly one active session for auto-selection', () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => new Date('2026-07-04T12:00:00.000Z').getTime(),
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });

    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });

    expect(service.listActiveSessions()).toEqual([
      {
        code: 'ABCD-1234',
        connectedControllerCount: 0,
        expiresAt: '2026-07-04T12:01:00.000Z',
        presenterDeviceId: 'MacBook Pro',
        presenterLabel: 'MacBook Pro',
        sessionId: 'session-1',
      },
    ]);
  });

  it('does not auto-select when multiple sessions are active', () => {
    const codes = ['ABCD-1234', 'EFGH-5678'];
    const ids = ['session-1', 'session-2'];
    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => new Date('2026-07-04T12:00:00.000Z').getTime(),
      randomCode: () => codes.shift() ?? 'JKLM-9012',
      randomId: () => ids.shift() ?? 'session-3',
    });

    service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.registerSession({ presenterLabel: 'Studio Display', ttlMs: 60_000 });

    expect(service.getSingleActiveSession()).toBeUndefined();
  });

  it('expires stale sessions and accepts reconnect offers for active sessions', () => {
    let now = new Date('2026-07-04T12:00:00.000Z').getTime();
    const service = new InMemoryPresenterRemoteSignalingService({
      now: () => now,
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    const session = service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });
    service.connectController(session.code, 'controller-1');

    expect(
      service.createControllerOffer({
        controllerId: 'controller-1',
        offerSdp: 'controller-offer',
        sessionCode: session.code,
      }),
    ).toEqual({ status: 'pending' });
    expect(service.takePendingOffers(session.code)).toEqual([
      { controllerId: 'controller-1', offerSdp: 'controller-offer' },
    ]);

    now = new Date('2026-07-04T12:02:00.000Z').getTime();

    expect(service.lookupSession(session.code)).toBeUndefined();
    expect(
      service.createControllerOffer({
        controllerId: 'controller-1',
        offerSdp: 'late-offer',
        sessionCode: session.code,
      }),
    ).toEqual({ status: 'not-found' });
  });

  it('trusts controllers only after pairing with the session code', () => {
    const service = new InMemoryPresenterRemoteSignalingService({
      randomCode: () => 'ABCD-1234',
      randomId: () => 'session-1',
    });
    const session = service.registerSession({ presenterLabel: 'MacBook Pro', ttlMs: 60_000 });

    expect(
      service.createControllerOffer({
        controllerId: 'controller-1',
        offerSdp: 'controller-offer',
        sessionCode: session.code,
      }),
    ).toEqual({ status: 'not-found' });
    expect(service.publishCommand(session.code, { command: 'next', type: 'command' }, 'controller-1')).toBe(false);

    expect(service.connectController(session.code, 'controller-1')).toMatchObject({
      connectedControllerCount: 1,
      code: 'ABCD-1234',
    });
    expect(
      service.createControllerOffer({
        controllerId: 'controller-1',
        offerSdp: 'controller-offer',
        sessionCode: session.code,
      }),
    ).toEqual({ status: 'pending' });
    expect(service.publishCommand(session.code, { command: 'next', type: 'command' }, 'controller-1')).toBe(true);
    expect(service.takeCommands(session.code)).toEqual([{ command: 'next', type: 'command' }]);
  });
});
