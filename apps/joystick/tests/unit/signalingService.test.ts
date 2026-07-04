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
});
