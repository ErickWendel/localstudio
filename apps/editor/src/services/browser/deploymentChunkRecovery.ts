interface DeploymentChunkRecoveryEventTarget {
  addEventListener(type: 'vite:preloadError', listener: (event: Event) => void): void;
}

interface DeploymentChunkRecoveryStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface DeploymentChunkRecoveryOptions {
  eventTarget?: DeploymentChunkRecoveryEventTarget;
  reload?: () => void;
  storage?: DeploymentChunkRecoveryStorage;
}

const recoveryStorageKey = 'localstudio.deployment-chunk-recovery';

export function installDeploymentChunkRecovery(options: DeploymentChunkRecoveryOptions = {}) {
  const eventTarget = options.eventTarget ?? window;
  const reload = options.reload ?? (() => window.location.reload());
  const storage = options.storage ?? window.sessionStorage;
  let recoveryTriggered = false;

  eventTarget.addEventListener('vite:preloadError', (event) => {
    try {
      if (storage.getItem(recoveryStorageKey) === 'attempted') return;
      storage.setItem(recoveryStorageKey, 'attempted');
    } catch {
      return;
    }

    recoveryTriggered = true;
    event.preventDefault();
    reload();
  });

  return {
    markApplicationReady() {
      if (recoveryTriggered) return;
      try {
        storage.removeItem(recoveryStorageKey);
      } catch {
        // Storage can be unavailable in restricted browsing contexts.
      }
    },
  };
}
