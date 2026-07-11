import { type MirrorFileGenerationContractInput } from './mirror-file-generation-contract-fixtures';

export type MirrorFileGenerationContractResult = {
  manifest: unknown;
  mirrorFilePaths: string[];
  mirroredAssetIds: string[];
  mirroredProjectAssetStorage: string | undefined;
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
  };

  return {
    manifest,
    mirrorFilePaths: mirrorFiles.map((file) => file.path).sort(),
    mirroredAssetIds: Object.keys(mirroredProject.assets).sort(),
    mirroredProjectAssetStorage: mirroredProject.assets['asset-used']?.storage,
    mirroredProjectUnreadableObjectUrl: mirroredProject.assets['asset-unreadable']?.objectUrl,
  };
}
