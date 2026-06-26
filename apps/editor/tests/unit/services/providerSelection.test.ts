import type { AiProviderState } from '../../../src/services/interfaces';
import { selectDefaultProvider } from '../../../src/services/providerSelection';

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

describe('selectDefaultProvider', () => {
  it('prefers ready Chrome over a stored external provider that is not downloaded', () => {
    const selected = selectDefaultProvider(
      [
        provider({ id: 'chrome-translator-api', runtime: 'chrome-built-in', readiness: 'ready' }),
        provider({ id: 'translategemma-webgpu', runtime: 'webgpu-huggingface', readiness: 'needs-download' }),
      ],
      'translategemma-webgpu',
    );

    expect(selected?.id).toBe('chrome-translator-api');
  });

  it('keeps a stored external provider when its model is ready', () => {
    const selected = selectDefaultProvider(
      [
        provider({ id: 'chrome-translator-api', runtime: 'chrome-built-in', readiness: 'ready' }),
        provider({ id: 'translategemma-webgpu', runtime: 'webgpu-huggingface', readiness: 'ready' }),
      ],
      'translategemma-webgpu',
    );

    expect(selected?.id).toBe('translategemma-webgpu');
  });

  it('keeps an explicit external click even when the model still needs download', () => {
    const selected = selectDefaultProvider(
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
