import { webMcpContractPage } from './webmcp-contract-page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes WebMCP tool adapter contracts in the browser runtime', async ({ page }) => {
  const result = await webMcpContractPage.run(page, serviceContractsSupport.getServer().baseURL);

  expect(result.toolNames).toEqual([
    'create_project',
    'generate_slides',
    'generate_image',
    'translate_text',
    'get_project_snapshot',
  ]);
  expect(result).toMatchObject({
    createProjectBlank: { data: { name: 'Untitled' }, ok: true },
    createProjectNamed: { data: { name: 'WebMCP Deck' }, ok: true },
    generatedImage: { data: { assetId: 'asset-generated' }, ok: true },
    generatedSlides: { data: { prompt: 'Create a launch slide' }, ok: true },
    registeredNames: [
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ],
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
  expect(result.individuallyRegisteredNames).toEqual(result.registeredNames);
  expect(result.toolDescriptions.join('\n')).toContain('Good prompt examples');
});
