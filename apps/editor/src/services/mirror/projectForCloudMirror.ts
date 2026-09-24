import { collectReferencedAssetIds } from '../../domain/assets/assetUsage';
import type { ProjectDocument } from '../../domain/documents/model';

function collectObjectUrls(project: ProjectDocument) {
  const objectUrls = new Set<string>();
  for (const asset of Object.values(project.assets)) {
    if (asset.objectUrl) objectUrls.add(asset.objectUrl);
  }
  for (const font of Object.values(project.fonts ?? {})) {
    if (font.objectUrl) objectUrls.add(font.objectUrl);
  }
  for (const recording of Object.values(project.recordings ?? {})) {
    if (recording.audio.objectUrl) objectUrls.add(recording.audio.objectUrl);
  }
  return objectUrls;
}

function revokeObjectUrl(objectUrl: string) {
  if (!objectUrl.startsWith('blob:') || typeof URL.revokeObjectURL !== 'function') return;
  try {
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Releasing a hydrated mirror snapshot must not fail the sync.
  }
}

function isCurrentPersistedProject(
  inMemoryProject: ProjectDocument,
  persistedProject: ProjectDocument,
) {
  if (persistedProject.id !== inMemoryProject.id) return false;
  const persistedTime = Date.parse(persistedProject.updatedAt);
  const memoryTime = Date.parse(inMemoryProject.updatedAt);
  if (!Number.isFinite(persistedTime) || !Number.isFinite(memoryTime)) return false;
  return persistedTime >= memoryTime;
}

function persistedCoversInMemoryProject(
  inMemoryProject: ProjectDocument,
  persistedProject: ProjectDocument,
) {
  if (!isCurrentPersistedProject(inMemoryProject, persistedProject)) return false;
  const persistedPageIds = new Set(persistedProject.pages.map((page) => page.id));
  if (inMemoryProject.pages.some((page) => !persistedPageIds.has(page.id))) return false;
  for (const assetId of collectReferencedAssetIds(inMemoryProject)) {
    if (!persistedProject.assets[assetId]) return false;
  }
  return true;
}

function releaseUnusedObjectUrls(source: ProjectDocument, liveProject: ProjectDocument) {
  if (source === liveProject) return;
  const liveObjectUrls = collectObjectUrls(liveProject);
  for (const objectUrl of collectObjectUrls(source)) {
    if (!liveObjectUrls.has(objectUrl)) revokeObjectUrl(objectUrl);
  }
}

export function projectForCloudMirror(
  inMemoryProject: ProjectDocument,
  persistedProject: ProjectDocument | null,
) {
  const usePersisted =
    persistedProject !== null && persistedCoversInMemoryProject(inMemoryProject, persistedProject);
  return {
    project: usePersisted && persistedProject ? persistedProject : inMemoryProject,
    release: () => {
      if (!persistedProject) return;
      releaseUnusedObjectUrls(persistedProject, inMemoryProject);
    },
  };
}
