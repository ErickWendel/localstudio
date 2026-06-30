import type { ProjectDocument } from './model';

export function collectReferencedAssetIds(project: ProjectDocument): Set<string> {
  const referencedAssetIds = new Set<string>();
  for (const element of Object.values(project.elements)) {
    if (element.type === 'image') referencedAssetIds.add(element.assetId);
  }
  for (const page of project.pages) {
    if (page.background.type === 'asset') referencedAssetIds.add(page.background.assetId);
  }
  return referencedAssetIds;
}
