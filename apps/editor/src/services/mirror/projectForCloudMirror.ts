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

export function projectForCloudMirror(
  inMemoryProject: ProjectDocument,
  persistedProject: ProjectDocument | null,
) {
  if (!persistedProject || !isCurrentPersistedProject(inMemoryProject, persistedProject)) {
    return { project: inMemoryProject, release: () => undefined };
  }
  const liveObjectUrls = collectObjectUrls(inMemoryProject);
  return {
    project: persistedProject,
    release: () => {
      if (persistedProject === inMemoryProject) return;
      for (const objectUrl of collectObjectUrls(persistedProject)) {
        if (!liveObjectUrls.has(objectUrl)) revokeObjectUrl(objectUrl);
      }
    },
  };
}
