/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes mirror file, logger, and mutation utility contracts in the browser runtime', async ({
  page,
}) => {
  await page.goto(new URL('/editor/?newProject=1', serviceContractsSupport.getServer().baseURL).toString());

  const result = await page.evaluate(async () => {
    const [{ minioMirrorFiles }, { projectMutationUtils }, { pptxImportLogger }] =
      (await Promise.all([
        import('/editor/src/services/mirror/minioMirrorFiles.ts'),
        import('/editor/src/domain/commands/shared/projectMutationUtils.ts'),
        import('/editor/src/services/importing/pptx/pptxImportLogger.ts'),
      ])) as [
        typeof import('../../../apps/editor/src/services/mirror/minioMirrorFiles'),
        typeof import('../../../apps/editor/src/domain/commands/shared/projectMutationUtils'),
        typeof import('../../../apps/editor/src/services/importing/pptx/pptxImportLogger'),
      ];

    const logs: string[] = [];
    const originalInfo = console.info;
    const originalError = console.error;
    console.info = (...values: unknown[]) => logs.push(`info:${JSON.stringify(values)}`);
    console.error = (...values: unknown[]) => logs.push(`error:${JSON.stringify(values)}`);
    pptxImportLogger.info('started');
    pptxImportLogger.info('with details', { slideCount: 2 });
    pptxImportLogger.error('failed', new TypeError('bad pptx'), { fileName: 'broken.pptx' });
    pptxImportLogger.error('object failed', { message: 'object message', name: 'ObjectError' });
    pptxImportLogger.error('plain failed', 'plain error');
    console.info = originalInfo;
    console.error = originalError;
    const project = {
      assets: {
        'asset-used': {
          id: 'asset-used',
          mimeType: 'image/png',
          name: 'Used image',
          objectUrl: 'data:image/png;base64,bWlycm9yLWltYWdl',
          type: 'image',
        },
        'asset-unused': {
          id: 'asset-unused',
          mimeType: 'image/png',
          name: 'Unused image',
          objectUrl: 'data:image/png;base64,dW51c2Vk',
          type: 'image',
        },
        'asset-unreadable': {
          id: 'asset-unreadable',
          mimeType: 'image/png',
          name: 'Unreadable image',
          objectUrl: 'https://example.test/unreadable.png',
          type: 'image',
        },
      },
      createdAt: '2026-07-09T00:00:00.000Z',
      elements: {
        'image-1': {
          assetId: 'asset-used',
          height: 100,
          id: 'image-1',
          locked: false,
          opacity: 1,
          rotation: 0,
          type: 'image',
          visible: true,
          width: 100,
          x: 0,
          y: 0,
        },
        'image-2': {
          assetId: 'asset-unreadable',
          height: 120,
          id: 'image-2',
          locked: false,
          opacity: 1,
          rotation: 0,
          type: 'image',
          visible: true,
          width: 120,
          x: 120,
          y: 0,
        },
      },
      fonts: {
        inter: {
          family: 'Inter',
          fileName: 'inter.woff2',
          id: 'inter',
          objectUrl: 'data:font/woff2;base64,bWlycm9yLWZvbnQ=',
          storage: 'browser',
        },
      },
      id: 'project-mirror-contract',
      name: 'Mirror Contract',
      pages: [
        {
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['image-1', 'image-2'],
          height: 1080,
          id: 'page-1',
          name: 'Slide 1',
          visible: true,
          width: 1920,
        },
      ],
      updatedAt: '2026-07-09T12:00:00.000Z',
    };
    const versionProject = {
      ...project,
      assets: {
        'asset-used': {
          ...project.assets['asset-used'],
          objectUrl: 'data:image/png;base64,dmVyc2lvbi1pbWFnZQ==',
        },
      },
      fonts: {},
      id: 'project-mirror-contract-version',
    };
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
        fetch: async () => new Response('remote-blob'),
        now: () => new Date('2026-07-09T12:34:00.000Z'),
      },
    );
    const manifest = JSON.parse(
      await mirrorFiles.find((file) => file.path === minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME)!.blob.text(),
    );
    const mirroredProject = JSON.parse(
      await mirrorFiles.find((file) => file.path === minioMirrorFiles.PROJECT_FILE_NAME)!.blob.text(),
    ) as { assets: Record<string, { objectUrl?: string; storage?: string }> };
    const touched = projectMutationUtils.touchProject(project);
    const timestamp = projectMutationUtils.getProjectUpdatedAt();
    return {
      logs,
      manifest,
      mirrorFilePaths: mirrorFiles.map((file) => file.path).sort(),
      mirroredAssetIds: Object.keys(mirroredProject.assets).sort(),
      mirroredProjectAssetStorage: mirroredProject.assets['asset-used']?.storage,
      mirroredProjectUnreadableObjectUrl: mirroredProject.assets['asset-unreadable']?.objectUrl,
      timestamp,
      touchedName: touched.name,
      touchedUpdatedAt: touched.updatedAt,
    };
  });

  expect(result).toMatchObject({
    mirroredAssetIds: ['asset-unreadable', 'asset-used'],
    mirroredProjectAssetStorage: 'file',
    mirroredProjectUnreadableObjectUrl: 'https://example.test/unreadable.png',
    touchedName: 'Mirror Contract',
  });
  expect(result.logs).toEqual(
    expect.arrayContaining([
      expect.stringContaining('[LocalStudio PPTX Import]'),
      expect.stringContaining('bad pptx'),
      expect.stringContaining('ObjectError'),
      expect.stringContaining('plain error'),
    ]),
  );
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
  expect(Date.parse(result.timestamp)).not.toBeNaN();
  expect(Date.parse(result.touchedUpdatedAt)).not.toBeNaN();
});
