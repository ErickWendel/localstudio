import { describe, expect, it, vi } from 'vitest';
import { PresenterRemoteSignalingClient } from '@localstudio/presenter-remote/signaling-client';

describe('PresenterRemoteSignalingClient', () => {
  it('treats a pending WebRTC answer response as empty instead of failed', async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(
        new Response('null', {
          headers: { 'content-type': 'application/json' },
          status: 200,
        }),
      ),
    ) as unknown as typeof fetch;
    const client = new PresenterRemoteSignalingClient({
      endpoint: '/__localstudio/presenter-remote',
      fetcher,
    });

    await expect(client.getAnswer('ABCD-1234', 'controller-1')).resolves.toBeUndefined();
  });
});
