/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';
import { mirrorFileContractProject } from './mirror-file-contract-project';

test('executes mirror file generation contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(
    async ({ project, versionProject }) => {
      const { minioMirrorFiles } = (await import(
        '/editor/src/services/mirror/minioMirrorFiles.ts'
      )) as typeof import('../../../apps/editor/src/services/mirror/minioMirrorFiles');

      const mirrorFiles = await minioMirrorFiles.createMirrorFiles(
        project,
        {
          getVersionHistory: async () => [
            {
              changeCount: 1,
              createdAt: '2026-07-09T12:01:00.000Z',
              fileName: 'version-1.json',
              id: 'version-1',
              projectName: 'Mirror Contract',
              summary: '1 edit',
            },
            {
              changeCount: 1,
              createdAt: '2026-07-09T12:02:00.000Z',
              fileName: 'missing-version.json',
              id: 'missing-version',
              projectName: 'Mirror Contract',
              summary: 'missing',
            },
          ],
          loadVersion: async (versionId) => (versionId === 'version-1' ? versionProject : null),
        },
        {
          accessKeyId: 'access',
          bucket: 'bucket',
          endpoint: 'https://s3.example.test',
          publicBaseUrl: ' https://cdn.example.test/public ',
          region: 'us-east-1',
          secretAccessKey: 'secret',
        },
        {
          fetch: () => Promise.resolve(new Response('remote-blob')),
          now: () => new Date('2026-07-09T12:34:00.000Z'),
        },
      );
      const manifest = JSON.parse(
        await mirrorFiles
          .find((file) => file.path === minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME)!
          .blob.text(),
      );
      const mirroredProject = JSON.parse(
        await mirrorFiles.find((file) => file.path === minioMirrorFiles.PROJECT_FILE_NAME)!.blob.text(),
      ) as { assets: Record<string, { objectUrl?: string; storage?: string }> };

      return {
        manifest,
        mirrorFilePaths: mirrorFiles.map((file) => file.path).sort(),
        mirroredAssetIds: Object.keys(mirroredProject.assets).sort(),
        mirroredProjectAssetStorage: mirroredProject.assets['asset-used']?.storage,
        mirroredProjectUnreadableObjectUrl: mirroredProject.assets['asset-unreadable']?.objectUrl,
      };
    },
    {
      project: mirrorFileContractProject.createProject(),
      versionProject: mirrorFileContractProject.createVersionProject(),
    },
  );

  expect(result).toMatchObject({
    mirroredAssetIds: ['asset-unreadable', 'asset-used'],
    mirroredProjectAssetStorage: 'file',
    mirroredProjectUnreadableObjectUrl: 'https://example.test/unreadable.png',
  });
  expect(result.manifest).toMatchObject({
    projectId: 'project-mirror-contract',
    projectName: 'Mirror Contract',
    publicBaseUrl: 'https://cdn.example.test/public',
    schemaVersion: 1,
    syncedAt: '2026-07-09T12:34:00.000Z',
  });
  expect(result.mirrorFilePaths).toEqual(
    expect.arrayContaining([
      'assets/asset-used.png',
      'config/localstudio.json',
      'fonts/inter.woff2',
      'history/manifest.json',
      'history/versions/version-1.json',
      'localstudio-mirror.json',
      'project.json',
    ]),
  );
});
