import type { AiProviderState } from '../../../services/contracts/interfaces';

export const aiToolsProviderFallbacks = {
  languageDetection(): AiProviderState {
    return {
      id: 'chrome-language-detector-api',
      label: 'Chrome Built-in Language Detector',
      description: 'Detect slide language using Chrome Built-in AI.',
      capability: 'language-detection',
      runtime: 'chrome-built-in',
      compatibility: 'compatible',
      readiness: 'ready',
      selected: true,
    };
  },
  prompt(promptReady: boolean): AiProviderState {
    return {
      id: 'chrome-prompt-api',
      label: 'Chrome Built-in Prompt API',
      description: 'Prompt to slides using Chrome Built-in AI.',
      capability: 'prompt',
      runtime: 'chrome-built-in',
      compatibility: 'compatible',
      readiness: promptReady ? 'ready' : 'needs-download',
      selected: true,
    };
  },
  translation(translationReady: boolean): AiProviderState {
    return {
      id: 'chrome-translator-api',
      label: 'Chrome Built-in Translator',
      description: 'Translate visible text using Chrome Built-in AI.',
      capability: 'translation',
      runtime: 'chrome-built-in',
      compatibility: 'compatible',
      readiness: translationReady ? 'ready' : 'needs-download',
      selected: true,
    };
  },
};
