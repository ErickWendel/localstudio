/* eslint-disable @typescript-eslint/require-await */
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes local file repository and asset storage contracts in the browser runtime', async ({
  page,
}) => {
  await page.addInitScript(installFakeOpfs, { directoryPicker: true });
  await page.goto(new URL('/editor/?newProject=1', serviceContractsSupport.getServer().baseURL).toString());

  const result = await page.evaluate(async () => {
    const [{ assetFileUtils }, { BrowserFileSystemProjectRepository }, { DisabledProjectRepository }] =
      (await Promise.all([
        import('/editor/src/services/storage/assetFileUtils.ts'),
        import('/editor/src/services/storage/browserFileSystemProjectRepository.ts'),
        import('/editor/src/services/storage/disabledProjectRepository.ts'),
      ])) as [
        typeof import('../../../apps/editor/src/services/storage/assetFileUtils'),
        typeof import('../../../apps/editor/src/services/storage/browserFileSystemProjectRepository'),
        typeof import('../../../apps/editor/src/services/storage/disabledProjectRepository'),
      ];

    const savedHandles: string[] = [];
    const repository = new BrowserFileSystemProjectRepository({
      recentProjectStore: {
        load: async () => null,
        save: async (handle, projectName) => {
          savedHandles.push(`${handle.name}:${projectName ?? ''}`);
        },
      },
    });
    const dataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM=';
    const fontUrl = 'data:font/woff2;base64,Zm9udC1ieXRlcw==';
    const project = {
      assets: {
        'asset-kept': {
          id: 'asset-kept',
          mimeType: 'image/png',
          name: 'Kept image',
          objectUrl: dataUrl,
          type: 'image',
        },
      },
      createdAt: '2026-07-09T00:00:00.000Z',
      elements: {
        'image-1': {
          assetId: 'asset-kept',
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
      },
      fonts: {
        inter: {
          family: 'Inter',
          fileName: 'inter.woff2',
          id: 'inter',
          objectUrl: fontUrl,
          storage: 'browser',
        },
      },
      id: 'project-file-contract',
      name: 'File Contract',
      pages: [
        {
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['image-1'],
          height: 1080,
          id: 'page-1',
          name: 'Slide 1',
          visible: true,
          width: 1920,
        },
      ],
      updatedAt: '2026-07-09T12:00:00.000Z',
    };

    await repository.saveProjectAs(project, { projectDirectoryName: 'File Contract' });
    const loadedProject = await repository.loadProject();
    const version = await repository.saveVersion(
      {
        ...project,
        name: 'File Contract v2',
        elements: {
          ...project.elements,
          'image-1': { ...project.elements['image-1'], x: 42 },
        },
      },
      { previousProject: project },
    );
    const history = await repository.getVersionHistory();
    const loadedVersion = await repository.loadVersion(version.id);
    const missingVersion = await repository.loadVersion('missing-version');

    const mirrorProject = {
      ...project,
      name: 'Mirrored Contract',
      assets: {
        'asset-kept': {
          fileName: 'asset-kept.png',
          id: 'asset-kept',
          mimeType: 'image/png',
          name: 'Kept image',
          storage: 'file',
          type: 'image',
        },
      },
      fonts: {},
    };
    const importedProject = await repository.importMirrorFiles([
      {
        blob: new Blob([JSON.stringify(mirrorProject)], { type: 'application/json' }),
        path: 'project.json',
      },
      {
        blob: new Blob(['mirror-image'], { type: 'image/png' }),
        path: 'assets/asset-kept.png',
      },
      {
        blob: new Blob([JSON.stringify({ schemaVersion: 1, versions: [] })], {
          type: 'application/json',
        }),
        path: 'history/manifest.json',
      },
    ]);

    const disabledRepository = new DisabledProjectRepository();
    await disabledRepository.saveProject(project);
    const disabledLoad = await disabledRepository.loadProject();

    const deniedRepository = new BrowserFileSystemProjectRepository({
      pickDirectory: async () =>
        ({
          name: 'denied-root',
          queryPermission: async () => 'denied',
          requestPermission: async () => 'denied',
        }) as unknown as FileSystemDirectoryHandle,
      recentProjectStore: {
        load: async () => null,
        save: async () => undefined,
      },
    });
    const permissionError = await deniedRepository
      .saveProject(project)
      .then(() => '')
      .catch((error) => (error instanceof Error ? error.message : String(error)));

    const remoteBlobText = await assetFileUtils
      .objectUrlToBlob('https://example.test/image.png', async () => new Response('remote-image'))
      .then((blob) => blob.text());
    const unreadableBlob = await assetFileUtils.objectUrlToBlobIfReadable(
      'https://example.test/no-fetch.png',
      undefined,
    );
    const readableBlob = await assetFileUtils.objectUrlToBlobIfReadable(dataUrl, undefined);

    const persistedKeys = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.key(index),
    )
      .filter((key): key is string => Boolean(key))
      .filter((key) => key.includes('localstudio.e2e.opfs.file:'))
      .sort();

    return {
      disabledLoad,
      extensions: [
        assetFileUtils.getAssetFileExtension('image/jpeg'),
        assetFileUtils.getAssetFileExtension('image/gif'),
        assetFileUtils.getAssetFileExtension('image/webp'),
        assetFileUtils.getAssetFileExtension('video/mp4'),
        assetFileUtils.getAssetFileExtension('video/webm'),
        assetFileUtils.getAssetFileExtension('video/quicktime'),
        assetFileUtils.getAssetFileExtension('application/octet-stream'),
      ],
      historyCount: history.length,
      importedAssetObjectUrl: importedProject.assets['asset-kept']?.objectUrl,
      importedName: importedProject.name,
      loadedAssetStorage: loadedProject?.assets['asset-kept']?.storage,
      loadedFontStorage: loadedProject?.fonts?.inter?.storage,
      loadedName: loadedProject?.name,
      loadedVersionName: loadedVersion?.name,
      missingVersion,
      permissionError,
      persistedKeys,
      readableBlobText: readableBlob ? await readableBlob.text() : '',
      remoteBlobText,
      savedHandles,
      unreadableBlob,
      versionSummary: version.summary,
    };
  });

  expect(result).toMatchObject({
    disabledLoad: null,
    extensions: ['jpg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'png'],
    historyCount: 1,
    importedName: 'Mirrored Contract',
    loadedAssetStorage: 'file',
    loadedFontStorage: 'file',
    loadedName: 'File Contract',
    loadedVersionName: 'File Contract v2',
    missingVersion: null,
    permissionError:
      'LocalStudio.dev needs permission to read and write the selected project folder.',
    readableBlobText: 'image-bytes',
    remoteBlobText: 'remote-image',
    unreadableBlob: undefined,
  });
  expect(result.importedAssetObjectUrl).toContain('blob:');
  expect(result.persistedKeys).toEqual(
    expect.arrayContaining([
      expect.stringContaining('File Contract/project.json'),
      expect.stringContaining('File Contract/config/localstudio.json'),
      expect.stringContaining('File Contract/assets/asset-kept.png'),
      expect.stringContaining('File Contract/fonts/inter.woff2'),
      expect.stringContaining('File Contract v2/history/manifest.json'),
      expect.stringContaining('File Contract v2/history/versions/'),
      expect.stringContaining('Mirrored Contract/project.json'),
    ]),
  );
  expect(result.savedHandles).toEqual(
    expect.arrayContaining([
      expect.stringContaining('File Contract'),
      expect.stringContaining('Mirrored Contract'),
    ]),
  );
  expect(result.versionSummary).toContain('edits');
});
