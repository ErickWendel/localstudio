import { webMcpContractPage } from './webmcp-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { evaluateWebMcpToolAdapterExecutionContract } from './webmcp-tool-adapter-execution-contract-browser';
import { evaluateWebMcpToolAdapterMetadataContract } from './webmcp-tool-adapter-metadata-contract-browser';
import { evaluateWebMcpToolAdapterRegistrationContract } from './webmcp-tool-adapter-registration-contract-browser';

test('executes WebMCP tool adapter metadata contracts in the browser runtime', async ({
  page,
}) => {
  const result = await webMcpContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateWebMcpToolAdapterMetadataContract,
  );

  expect(result.toolNames).toEqual([
    'create_project',
    'generate_slides',
    'generate_image',
    'translate_text',
    'get_project_snapshot',
  ]);
  expect(result.toolDescriptions.join('\n')).toContain('Good prompt examples');
});

test('executes WebMCP tool adapter execution contracts in the browser runtime', async ({
  page,
}) => {
  const result = await webMcpContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateWebMcpToolAdapterExecutionContract,
  );

  expect(result).toMatchObject({
    createProjectBlank: { data: { name: 'Untitled' }, ok: true },
    createProjectNamed: { data: { name: 'WebMCP Deck' }, ok: true },
    generatedImage: { data: { assetId: 'asset-generated' }, ok: true },
    generatedSlides: { data: { prompt: 'Create a launch slide' }, ok: true },
    snapshot: { data: { pageCount: 1 }, ok: true },
    translated: { data: { scope: 'slide' }, ok: true },
    translatedWithoutPage: { data: { scope: 'deck' }, ok: true },
  });
  expect(result.controllerCalls.map((call) => call.name)).toEqual([
    'createProject',
    'createProject',
    'generateSlides',
    'generateImage',
    'translateText',
    'translateText',
    'getProjectSnapshot',
  ]);
});

test('executes WebMCP tool adapter registration contracts in the browser runtime', async ({
  page,
}) => {
  const result = await webMcpContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateWebMcpToolAdapterRegistrationContract,
  );

  expect(result.registeredNames).toEqual([
    'create_project',
    'generate_slides',
    'generate_image',
    'translate_text',
    'get_project_snapshot',
  ]);
  expect(result.individuallyRegisteredNames).toEqual(result.registeredNames);
});
