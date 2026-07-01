import type { AiProviderState, ModelState } from './interfaces';
import { getBrowserLocalStorage, type BrowserKeyValueStorage } from './browserStorage';

export function getBrowserProviderStorage(): BrowserKeyValueStorage | undefined {
  return getBrowserLocalStorage();
}

export function isWebGpuCompatible() {
  return typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
}

export function getModelReadiness(modelStates: ModelState[], modelId: string | undefined): AiProviderState['readiness'] {
  if (!modelId) return 'ready';
  return modelStates.find((state) => state.id === modelId)?.status ?? 'needs-download';
}

export function selectDefaultProvider(
  providers: AiProviderState[],
  preferredProviderId: string | null | undefined,
  options: { forcePreferred?: boolean } = {},
) {
  const compatibleProviders = providers.filter((provider) => provider.compatibility === 'compatible');
  const preferredProvider = compatibleProviders.find((provider) => provider.id === preferredProviderId);
  const chromeProvider = compatibleProviders.find((provider) => provider.runtime === 'chrome-built-in');

  if (
    preferredProvider &&
    (options.forcePreferred ||
      preferredProvider.runtime === 'chrome-built-in' ||
      preferredProvider.readiness === 'ready' ||
      chromeProvider?.readiness !== 'ready')
  ) {
    return preferredProvider;
  }

  return (
    chromeProvider ??
    compatibleProviders.find((provider) => provider.readiness === 'ready') ??
    compatibleProviders.find((provider) => provider.runtime === 'webgpu-huggingface') ??
    providers[0]
  );
}
