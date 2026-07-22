import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { evaluateChromeTranslatorServiceContract } from './chrome-translator-service-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Chrome translator service contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(evaluateChromeTranslatorServiceContract);

  expect(result).toEqual({
    browserTranslator: {
      browserModelDownloads: ['translategemma-webgpu', 'language-detection-webgpu'],
      browserProgress: [42, 99, 100, 42, 99, 100],
      defaultProviderId: 'chrome-translator-api',
      gemmaTranslation: 'translated by gemma',
      generatedPayloads: [
        [
          {
            content: [
              {
                source_lang_code: 'en',
                target_lang_code: 'pt_BR',
                text: 'hello world',
                type: 'text',
              },
            ],
            role: 'user',
          },
        ],
      ],
      languageStates: [
        {
          id: 'chrome-language-detector-api',
          readiness: 'unavailable',
          selected: false,
        },
        {
          id: 'language-detection-webgpu',
          readiness: 'ready',
          selected: true,
        },
      ],
      noChromeStates: [
        {
          disabledReason: 'Chrome Built-in Translator is unavailable in this browser.',
          id: 'chrome-translator-api',
          readiness: 'unavailable',
        },
        {
          disabledReason: undefined,
          id: 'translategemma-webgpu',
          readiness: 'ready',
        },
      ],
      skippedPreparationDetected: 'en',
      throwingStateReason: 'Chrome Built-in Translator readiness could not be checked.',
      unavailableStateReason: 'Chrome Built-in Translator reports unavailable.',
      unknownLanguageProviderMessage: 'Unknown language detection provider: missing-language-provider',
      unknownProviderMessage: 'Unknown translation provider: missing-provider',
      unsupportedGemmaMessage: 'TranslateGemma does not support xx-ZZ.',
      webGpuDetected: 'pt_br',
    },
    createFailureMessage: 'translator create failed',
    createdPairs: ['en:pt', 'en:it'],
    detected: 'zh-Hant',
    fallbackDetected: expect.any(String),
    hasDetector: false,
    normalized: ['es', 'zh-Hant'],
    progress: [42, 100],
    sameLanguage: 'same',
    translated: 'en->pt:hello',
    unavailableMessage:
      'Chrome Built-in AI translation is not ready for en to fr. Availability: unavailable.',
  });
});
