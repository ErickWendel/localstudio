import { webMcpContractPage } from './webmcp-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { evaluateWebMcpToolAdapterExecutionContract } from './webmcp-tool-adapter-execution-contract-browser';
import { evaluateWebMcpToolAdapterMetadataContract } from './webmcp-tool-adapter-metadata-contract-browser';
import { evaluateWebMcpToolAdapterRegistrationContract } from './webmcp-tool-adapter-registration-contract-browser';

test('executes WebMCP tool adapter metadata contracts in the browser runtime', async ({ page }) => {
  const result = await webMcpContractPage.run(
    page,
    serviceContractsSupport.getServer().baseURL,
    evaluateWebMcpToolAdapterMetadataContract,
  );

  expect(result.toolNames).toEqual([
    'create_presentation',
    'get_presentation_state',
    'import_powerpoint_from_url',
    'translate_deck_and_notes',
    'generate_deck_detailed_description',
    'list_authoring_catalog',
    'upsert_slide_content',
    'generate_image',
    'get_slide_preview',
    'get_ai_model_status',
    'prepare_ai_models',
    'search_media',
    'export_presentation',
    'publish_presentation',
    'get_operation_status',
  ]);
  expect(result.toolTitles.every(Boolean)).toBe(true);
  expect(result.readOnlyNames).toEqual([
    'get_presentation_state',
    'list_authoring_catalog',
    'get_ai_model_status',
    'search_media',
    'get_operation_status',
  ]);
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
    created: { data: { name: 'WebMCP Deck', projectId: 'project-1' }, ok: true },
    state: { data: { pageCount: 1, projectId: 'project-1' }, ok: true },
    preview: { data: { slideId: 'page-1', slideNumber: 1 }, ok: true },
    imageOperation: { data: { status: 'queued' }, ok: true },
    imageStatus: { data: { state: 'completed', result: { assetId: 'asset-generated' } }, ok: true },
  });
  expect(result.controllerCalls.map((call) => call.name)).toEqual([
    'createPresentation',
    'getPresentationState',
    'getSlidePreview',
    'generateImage',
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
    'create_presentation',
    'get_presentation_state',
    'import_powerpoint_from_url',
    'translate_deck_and_notes',
    'generate_deck_detailed_description',
    'list_authoring_catalog',
    'upsert_slide_content',
    'generate_image',
    'get_slide_preview',
    'get_ai_model_status',
    'prepare_ai_models',
    'search_media',
    'export_presentation',
    'publish_presentation',
    'get_operation_status',
  ]);
  expect(result.individuallyRegisteredNames).toEqual(result.registeredNames);
  expect(result.batchCleanupCount).toBe(15);
  expect(result.individualCleanupCount).toBe(15);
  expect(result.duplicateBatchIgnored).toBe(true);
  expect(result.duplicateIndividualIgnored).toBe(true);
  expect(result.nonDuplicateErrorName).toBe('registration failed');
});
