import { commandContractAssets } from './command-contract-assets';
import { commandContractElements } from './command-contract-elements';
import { commandContractPages } from './command-contract-pages';

export function createCommandContractProject() {
  return {
    assets: commandContractAssets.create(),
    createdAt: '2026-01-01T00:00:00.000Z',
    elements: commandContractElements.create(),
    fonts: {},
    id: 'project-1',
    name: 'Command Contract',
    pages: commandContractPages.create(),
    themeGallery: [],
    themes: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
