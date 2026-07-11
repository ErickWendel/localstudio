import { transformersFallbackContractPage } from './transformers-fallback-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Transformers fallback and runtime wrapper contracts in the browser runtime', async ({
  page,
}) => {
  const result = await transformersFallbackContractPage.runFallbackAndWrapperContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    fallbackLanguage: { language: 'pt', score: 0.77 },
    fallbackSegmentationScore: 1,
    fallbackText: 'fallback text',
    runtimeLanguage: { language: 'pt', score: 0.77 },
    runtimeText: 'fallback text',
  });
  expect(result.fallbackCalls).toEqual(
    expect.arrayContaining([
      'preload-text:fallback-llm',
      'generate:fallback prompt',
      'release:fallback-llm',
      'remove:fallback-llm',
      'preload-language:fallback-lang',
      'detect:olá',
      'preload-image-editing',
      'prepare:asset://fallback',
      'segment:asset://fallback:1',
      'remove-image-editing',
    ]),
  );
});
