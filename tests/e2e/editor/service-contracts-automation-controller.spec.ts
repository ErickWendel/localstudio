import { expect, test } from '../support/journey-test';
import { automationControllerContractPage } from './automation-controller-contract-page';
import { evaluateAutomationControllerCreateContract } from './automation-controller-create-contract-browser';
import { evaluateAutomationControllerImageContract } from './automation-controller-image-contract-browser';
import { evaluateAutomationControllerSlidesContract } from './automation-controller-slides-contract-browser';
import { evaluateAutomationControllerSnapshotContract } from './automation-controller-snapshot-contract-browser';
import { evaluateAutomationControllerTranslationContract } from './automation-controller-translation-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';

test('executes editor automation project creation contracts in the browser runtime', async ({
  page,
}) => {
  const result = await automationControllerContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateAutomationControllerCreateContract,
  );

  expect(result).toMatchObject({
    createdName: 'Automated Deck',
  });
});

test('executes editor automation slide generation contracts in the browser runtime', async ({
  page,
}) => {
  const result = await automationControllerContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateAutomationControllerSlidesContract,
  );

  expect(result).toMatchObject({
    emptySlidesError: 'empty_prompt',
    generatedSlidesName: 'Generated deck',
  });
});

test('executes editor automation image generation contracts in the browser runtime', async ({
  page,
}) => {
  const result = await automationControllerContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateAutomationControllerImageContract,
  );

  expect(result).toMatchObject({
    generatedImageOk: true,
    invalidImageError: 'invalid_image_dimensions',
  });
});

test('executes editor automation translation contracts in the browser runtime', async ({
  page,
}) => {
  const result = await automationControllerContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateAutomationControllerTranslationContract,
  );

  expect(result).toMatchObject({
    invalidTranslationError: 'invalid_translation_scope',
    translatedText: '[pt] selection',
  });
});

test('executes editor automation snapshot contracts in the browser runtime', async ({ page }) => {
  const result = await automationControllerContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateAutomationControllerSnapshotContract,
  );

  expect(result).toMatchObject({
    snapshotPageCount: 1,
  });
});
