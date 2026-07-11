import { expect, test } from '../support/journey-test';
import { automationControllerContractPage } from './automation-controller-contract-page';
import { serviceContractsSupport } from './service-contracts-support';

test('executes editor automation controller contracts in the browser runtime', async ({ page }) => {
  const result = await automationControllerContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
  );

  expect(result).toMatchObject({
    createdName: 'Automated Deck',
    emptySlidesError: 'empty_prompt',
    generatedImageOk: true,
    generatedSlidesName: 'Generated deck',
    invalidImageError: 'invalid_image_dimensions',
    invalidTranslationError: 'invalid_translation_scope',
    snapshotPageCount: 1,
    translatedText: '[pt] selection',
  });
});
