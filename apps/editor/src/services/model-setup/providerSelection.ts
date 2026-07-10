import type { AiProviderState, ModelState } from '../contracts/interfaces';
import { browserStorage } from '../browser/browserStorage';
import type { BrowserKeyValueStorage } from '../browser/browserStorage';

function getBrowserProviderStorage(): BrowserKeyValueStorage | undefined {
  return browserStorage.getBrowserLocalStorage();
}

function isWebGpuCompatible() {
  return (
    typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu)
  );
}

function getModelReadiness(
  modelStates: ModelState[],
  modelId: string | undefined,
): AiProviderState['readiness'] {
  if (!modelId) return 'ready';
  return modelStates.find((state) => state.id === modelId)?.status ?? 'needs-download';
}

function selectDefaultProvider(
  providers: AiProviderState[],
  preferredProviderId: string | null | undefined,
  options: { forcePreferred?: boolean } = {},
) {
  const compatibleProviders = providers.filter(
    (provider) => provider.compatibility === 'compatible',
  );
  const preferredProvider = compatibleProviders.find(
    (provider) => provider.id === preferredProviderId,
  );
  const chromeProvider = compatibleProviders.find(
    (provider) => provider.runtime === 'chrome-built-in',
  );

  if (
    preferredProvider &&
    (options.forcePreferred ||
      preferredProvider.runtime === 'chrome-built-in' ||
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

export const providerSelection = {
  getBrowserProviderStorage,
  isWebGpuCompatible,
  getModelReadiness,
  selectDefaultProvider,
};
