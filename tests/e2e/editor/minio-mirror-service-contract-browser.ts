export type MinioMirrorServiceContractResult = {
  deleteError: string;
  deleteObjectError: string;
  downloadedPaths: string[];
  downloadFileError: string;
  downloadProgress: Array<{
    currentFile: string | undefined;
    downloadedBytes: number;
    downloadedFiles: number;
    totalBytes: number;
    totalFiles: number;
  }>;
  listError: string;
  listOrder: string[];
  uploadError: string;
};

export async function evaluateMinioMirrorServiceContract(): Promise<MinioMirrorServiceContractResult> {
  const { minioMirrorService } = (await import(
    '/editor/src/services/mirror/minioMirrorService.ts'
  )) as typeof import('../../../apps/editor/src/services/mirror/minioMirrorService');

  const config = {
    accessKey: 'writer',
    bucket: 'localstudio',
    endpoint: 'https://s3.localstudio.test',
    pathStyle: true,
    prefix: 'mirrors',
    publicBaseUrl: 'https://cdn.localstudio.test',
    readerAccessKey: 'reader',
    readerSecretKey: 'reader-secret',
    region: 'us-east-1',
    secretKey: 'writer-secret',
    writerAccessKey: 'writer',
    writerSecretKey: 'writer-secret',
  };

  const manifestXml = [
    '<ListBucketResult>',
    '<Contents><Key>mirrors/beta/localstudio-mirror.json</Key></Contents>',
    '<Contents><Key>mirrors/alpha/localstudio-mirror.json</Key></Contents>',
    '<Contents><Key>mirrors/zulu/localstudio-mirror.json</Key></Contents>',
    '</ListBucketResult>',
  ].join('');
  const objectListXml = [
    '<ListBucketResult>',
    '<IsTruncated>true</IsTruncated>',
    '<NextContinuationToken>second-page</NextContinuationToken>',
    '<Contents><Key>mirrors/project/project.json</Key></Contents>',
    '</ListBucketResult>',
  ].join('');
  const objectListSecondPageXml = [
    '<ListBucketResult>',
    '<IsTruncated>false</IsTruncated>',
    '<Contents><Key>mirrors/project/assets/image.png</Key></Contents>',
    '</ListBucketResult>',
  ].join('');
  const stringifyFetchInput = (input: RequestInfo | URL) => {
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    return input;
  };

  const service = new minioMirrorService.MinioMirrorService({
    fetch: (input, init) => {
      const url = stringifyFetchInput(input);
      const method = init?.method ?? 'GET';
      if (method === 'PUT') return Promise.resolve(new Response('', { status: 201 }));
      if (method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      if (url.includes('list-type=2') && url.includes('continuation-token=second-page')) {
        return Promise.resolve(new Response(objectListSecondPageXml));
      }
      if (url.includes('list-type=2') && url.includes('prefix=mirrors%2Fproject%2F')) {
        return Promise.resolve(new Response(objectListXml));
      }
      if (url.includes('list-type=2')) return Promise.resolve(new Response(manifestXml));
      if (url.includes('/beta/localstudio-mirror.json')) {
        return Promise.resolve(Response.json({
          files: {},
          projectId: 'project-beta',
          projectName: 'Beta Project',
          publicBaseUrl: config.publicBaseUrl,
          schemaVersion: 1,
          syncedAt: 'not-a-date',
        }));
      }
      if (url.includes('/alpha/localstudio-mirror.json')) {
        return Promise.resolve(Response.json({
          files: {},
          projectId: 'project-alpha',
          projectName: 'Alpha Project',
          publicBaseUrl: config.publicBaseUrl,
          schemaVersion: 1,
          syncedAt: 'not-a-date',
        }));
      }
      if (url.includes('/zulu/localstudio-mirror.json')) {
        return Promise.resolve(Response.json({
          files: {},
          projectId: 'project-zulu',
          projectName: 'Zulu Project',
          publicBaseUrl: config.publicBaseUrl,
          schemaVersion: 1,
          syncedAt: '2026-07-22T10:00:00.000Z',
        }));
      }
      if (url.includes('/download/localstudio-mirror.json')) {
        return Promise.resolve(Response.json({
          files: {
            'fallback-path.json': {
              checksum: 'checksum-project',
              contentType: 'application/json',
              path: '',
              size: 0,
            },
            'media.bin': {
              checksum: 'checksum-media',
              contentType: 'application/octet-stream',
              path: 'media.bin',
              size: 3,
            },
          },
          projectId: 'project-download',
          projectName: 'Download Project',
          publicBaseUrl: config.publicBaseUrl,
          schemaVersion: 1,
          syncedAt: '2026-07-22T10:00:00.000Z',
        }));
      }
      if (url.includes('/download/fallback-path.json')) {
        return Promise.resolve(Response.json({ name: 'Download' }));
      }
      if (url.includes('/download/media.bin')) return Promise.resolve(new Response('abc'));
      return Promise.resolve(new Response('', { status: 404 }));
    },
  });

  const listOrder = (await service.listProjects(config)).map((project) => project.name);
  const downloadProgress: MinioMirrorServiceContractResult['downloadProgress'] = [];
  const downloadedFiles = await service.downloadProject('download', config, {
    onProgress: (progress) =>
      downloadProgress.push({
        currentFile: progress.currentFile,
        downloadedBytes: progress.downloadedBytes,
        downloadedFiles: progress.downloadedFiles,
        totalBytes: progress.totalBytes,
        totalFiles: progress.totalFiles,
      }),
  });
  await service.deleteProject('project', config);

  const messageFor = async (operation: () => Promise<unknown>) =>
    operation().then(
      () => 'missing-error',
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );
  const errorService = (status: number, match: (input: string, init?: RequestInit) => boolean) =>
    new minioMirrorService.MinioMirrorService({
      fetch: (input, init) =>
        Promise.resolve(
          match(stringifyFetchInput(input), init)
            ? new Response('', { status })
            : new Response(manifestXml),
        ),
    });

  const listError = await messageFor(() => errorService(500, (url) => url.includes('list-type=2')).listProjects(config));
  const downloadFileError = await messageFor(() =>
    new minioMirrorService.MinioMirrorService({
      fetch: (input) => {
        const url = stringifyFetchInput(input);
        if (url.includes('/broken/localstudio-mirror.json')) {
          return Promise.resolve(Response.json({
            files: {
              'project.json': {
                checksum: 'checksum-project',
                contentType: 'application/json',
                path: 'project.json',
                size: 1,
              },
            },
            projectId: 'project-broken',
            projectName: 'Broken Project',
            publicBaseUrl: config.publicBaseUrl,
            schemaVersion: 1,
            syncedAt: '2026-07-22T10:00:00.000Z',
          }));
        }
        if (url.includes('/broken/project.json')) {
          return Promise.resolve(new Response('', { status: 500 }));
        }
        return Promise.resolve(new Response('', { status: 404 }));
      },
    }).downloadProject('broken', config),
  );
  const deleteError = await messageFor(() =>
    errorService(500, (url) => url.includes('list-type=2')).deleteProject('project', config),
  );
  const deleteObjectError = await messageFor(() =>
    new minioMirrorService.MinioMirrorService({
      fetch: (_input, init) =>
        Promise.resolve(
          init?.method === 'DELETE'
            ? new Response('', { status: 500 })
            : new Response(objectListSecondPageXml),
        ),
    }).deleteProject('project', config),
  );
  const uploadError = await messageFor(() =>
    new minioMirrorService.MinioMirrorService({
      fetch: () => Promise.resolve(new Response('', { status: 500 })),
    }).uploadPublicObject('mirrors/share.json', new Blob(['{}']), config),
  );

  return {
    deleteError,
    deleteObjectError,
    downloadedPaths: downloadedFiles.map((file) => file.path).sort(),
    downloadFileError,
    downloadProgress,
    listError,
    listOrder,
    uploadError,
  };
}
