import { type MirrorFileGenerationContractInput } from './mirror-file-generation-contract-fixtures';

export type MirrorFileGenerationContractResult = {
  defaultPublicBaseUrl: string | undefined;
  manifest: unknown;
  mirrorFilePaths: string[];
  mirroredAssetIds: string[];
  mirroredFontStorage: string | undefined;
  mirroredProjectAssetStorage: string | undefined;
  mirroredRecordingObjectUrl: string | undefined;
  mirroredRecordingStorage: string | undefined;
  mirroredProjectUnreadableObjectUrl: string | undefined;
};

export async function evaluateMirrorFileGenerationContract({
  config,
  nowIso,
  project,
  versionHistory,
  versionProject,
}: MirrorFileGenerationContractInput): Promise<MirrorFileGenerationContractResult> {
  const { minioMirrorFiles } = (await import(
    '/editor/src/services/mirror/minioMirrorFiles.ts'
  )) as typeof import('../../../apps/editor/src/services/mirror/minioMirrorFiles');

  const mirrorFiles = await minioMirrorFiles.createMirrorFiles(
    project,
    {
      getVersionHistory: () => Promise.resolve(versionHistory),
      loadVersion: (versionId) =>
        Promise.resolve(versionId === 'version-1' ? versionProject : null),
    },
    config,
    {
      fetch: () => Promise.resolve(new Response('remote-blob')),
      now: () => new Date(nowIso),
    },
  );
  const manifestFile = mirrorFiles.find(
    (file) => file.path === minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME,
  );
  const projectFile = mirrorFiles.find((file) => file.path === minioMirrorFiles.PROJECT_FILE_NAME);
  if (!manifestFile || !projectFile) {
    throw new Error('mirror files should include manifest and project payloads');
  }

  const manifest = JSON.parse(await manifestFile.blob.text()) as unknown;
  const mirroredProject = JSON.parse(await projectFile.blob.text()) as {
    assets: Record<string, { objectUrl?: string; storage?: string }>;
    fonts?: Record<string, { objectUrl?: string; storage?: string }>;
    recordings?: Record<string, { audio: { objectUrl?: string; storage?: string } }>;
  };
  const defaultPublicBaseUrlFiles = await minioMirrorFiles.createMirrorFiles(
    project,
    {},
    { ...config, publicBaseUrl: '   ' },
    {
      fetch: () => Promise.resolve(new Response('remote-blob')),
      now: () => new Date(nowIso),
    },
  );
  const defaultManifestFile = defaultPublicBaseUrlFiles.find(
    (file) => file.path === minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME,
  );
  const defaultManifest = defaultManifestFile
    ? (JSON.parse(await defaultManifestFile.blob.text()) as { publicBaseUrl?: string })
    : {};

  return {
    defaultPublicBaseUrl: defaultManifest.publicBaseUrl,
    manifest,
    mirrorFilePaths: mirrorFiles.map((file) => file.path).sort(),
    mirroredAssetIds: Object.keys(mirroredProject.assets).sort(),
    mirroredFontStorage: mirroredProject.fonts?.fallback?.storage,
    mirroredProjectAssetStorage: mirroredProject.assets['asset-used']?.storage,
    mirroredRecordingObjectUrl:
      mirroredProject.recordings?.['recording-unreadable']?.audio.objectUrl,
    mirroredRecordingStorage:
      mirroredProject.recordings?.['recording-readable']?.audio.storage,
    mirroredProjectUnreadableObjectUrl: mirroredProject.assets['asset-unreadable']?.objectUrl,
  };
}
