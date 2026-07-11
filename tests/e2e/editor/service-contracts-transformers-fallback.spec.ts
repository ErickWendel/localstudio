import { transformersFallbackContractPage } from './transformers-fallback-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes Transformers text generation fallback operations in the browser runtime', async ({
  page,
}) => {
  const result = await transformersFallbackContractPage.runFallbackTextContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    text: 'fallback text',
  });
  expect(result.calls).toEqual([
    'preload-text:fallback-llm',
    'generate:fallback prompt',
    'release:fallback-llm',
    'remove:fallback-llm',
  ]);
});

test('executes Transformers language detection fallback operations in the browser runtime', async ({
  page,
}) => {
  const result = await transformersFallbackContractPage.runFallbackLanguageContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    language: { language: 'pt', score: 0.77 },
  });
  expect(result.calls).toEqual(['preload-language:fallback-lang', 'detect:ola']);
});

test('executes Transformers image editing fallback operations in the browser runtime', async ({
  page,
}) => {
  const result = await transformersFallbackContractPage.runFallbackImageContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    segmentationScore: 1,
  });
  expect(result.calls).toEqual([
    'preload-image-editing',
    'prepare:asset://fallback',
    'segment:asset://fallback:1',
    'remove-image-editing',
  ]);
});

test('executes Transformers runtime wrappers over fallback operations in the browser runtime', async ({
  page,
}) => {
  const result = await transformersFallbackContractPage.runFallbackWrapperContract(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    language: { language: 'pt', score: 0.77 },
    text: 'fallback text',
  });
  expect(result.calls).toEqual([
    'preload-text:runtime-llm',
    'release:runtime-llm',
    'generate:runtime prompt',
    'remove:runtime-llm',
    'preload-language:runtime-lang',
    'detect:runtime text',
  ]);
});
