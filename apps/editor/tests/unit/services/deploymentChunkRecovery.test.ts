import { installDeploymentChunkRecovery } from '../../../src/services/browser/deploymentChunkRecovery';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

describe('installDeploymentChunkRecovery', () => {
  it('reloads once for a stale Vite chunk and clears the guard after a successful boot', () => {
    const storage = createStorage();
    const reload = vi.fn();
    const stalePageTarget = new EventTarget();
    const stalePageRecovery = installDeploymentChunkRecovery({
      eventTarget: stalePageTarget,
      reload,
      storage,
    });

    const firstError = new Event('vite:preloadError', { cancelable: true });
    expect(stalePageTarget.dispatchEvent(firstError)).toBe(false);
    expect(firstError.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    stalePageRecovery.markApplicationReady();
    const repeatedError = new Event('vite:preloadError', { cancelable: true });
    expect(stalePageTarget.dispatchEvent(repeatedError)).toBe(true);
    expect(repeatedError.defaultPrevented).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    const recoveredPageTarget = new EventTarget();
    const recoveredPageRecovery = installDeploymentChunkRecovery({
      eventTarget: recoveredPageTarget,
      reload,
      storage,
    });
    recoveredPageRecovery.markApplicationReady();
    const laterDeploymentError = new Event('vite:preloadError', { cancelable: true });
    expect(recoveredPageTarget.dispatchEvent(laterDeploymentError)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('leaves the error visible when session storage cannot guard a reload', () => {
    const eventTarget = new EventTarget();
    const reload = vi.fn();
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('storage unavailable');
      }),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    installDeploymentChunkRecovery({ eventTarget, reload, storage });

    const event = new Event('vite:preloadError', { cancelable: true });
    expect(eventTarget.dispatchEvent(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
