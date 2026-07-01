import type { AiProviderState } from '../../../src/services/interfaces';
import { providerSelection } from '../../../src/services/model-setup/providerSelection';

function provider(patch: Partial<AiProviderState> & Pick<AiProviderState, 'id' | 'runtime'>): AiProviderState {
  return {
    ...patch,
    label: patch.id,
    description: patch.id,
    capability: 'translation',
    compatibility: patch.compatibility ?? 'compatible',
    readiness: patch.readiness ?? 'ready',
    selected: false,
  };
}

describe('providerSelection.selectDefaultProvider', () => {
  it('prefers ready Chrome over a stored external provider that is not downloaded', () => {
    const selected = providerSelection.selectDefaultProvider(
      [
        provider({ id: 'chrome-translator-api', runtime: 'chrome-built-in', readiness: 'ready' }),
        provider({ id: 'translategemma-webgpu', runtime: 'webgpu-huggingface', readiness: 'needs-download' }),
      ],
      'translategemma-webgpu',
    );

    expect(selected?.id).toBe('chrome-translator-api');
  });

  it('keeps a stored external provider when its model is ready', () => {
    const selected = providerSelection.selectDefaultProvider(
      [
        provider({ id: 'chrome-translator-api', runtime: 'chrome-built-in', readiness: 'ready' }),
        provider({ id: 'translategemma-webgpu', runtime: 'webgpu-huggingface', readiness: 'ready' }),
      ],
      'translategemma-webgpu',
    );

    expect(selected?.id).toBe('translategemma-webgpu');
  });

  it('keeps an explicit external click even when the model still needs download', () => {
    const selected = providerSelection.selectDefaultProvider(
      [
        provider({ id: 'chrome-translator-api', runtime: 'chrome-built-in', readiness: 'ready' }),
        provider({ id: 'translategemma-webgpu', runtime: 'webgpu-huggingface', readiness: 'needs-download' }),
      ],
      'translategemma-webgpu',
      { forcePreferred: true },
    );

    expect(selected?.id).toBe('translategemma-webgpu');
  });
});
