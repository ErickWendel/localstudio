import type { ImportWarning, ProjectDocument } from '../../../src/domain/documents/model';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { PowerPointUrlImportService } from '../../../src/services/automation/powerPointUrlImportService';
import type {
  FontImportService,
  PresentationImportService,
} from '../../../src/services/contracts/interfaces';

const pptxMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function createImportedProject(warnings: ImportWarning[] = []): ProjectDocument {
  const project = sampleProject.createSampleProject();
  return {
    ...project,
    id: 'project-imported',
    pages: [
      project.pages[0]!,
      { ...project.pages[0]!, id: 'page-2', name: 'Slide 2', elementIds: [] },
    ],
    importWarnings: warnings,
  };
}

function createResponse(
  body: BodyInit = new Uint8Array([80, 75, 3, 4]),
  options: {
    contentDisposition?: string;
    contentLength?: string;
    contentType?: string;
    status?: number;
  } = {},
) {
  const headers = new Headers();
  if (options.contentType !== undefined) headers.set('content-type', options.contentType);
  if (options.contentLength !== undefined) headers.set('content-length', options.contentLength);
  if (options.contentDisposition !== undefined) {
    headers.set('content-disposition', options.contentDisposition);
  }
  return new Response(body, { headers, status: options.status ?? 200 });
}

function createHarness(
  overrides: {
    fetch?: typeof fetch;
    importPowerPoint?: PresentationImportService['importPowerPoint'];
    maxFileSizeBytes?: number;
    maxWarnings?: number;
    project?: ProjectDocument;
    resolveAndDownloadFonts?: FontImportService['resolveAndDownloadFonts'];
  } = {},
) {
  const project = overrides.project ?? createImportedProject();
  const requestFetch =
    overrides.fetch ??
    vi.fn(() =>
      Promise.resolve(
        createResponse(undefined, {
          contentLength: '4',
          contentType: pptxMimeType,
        }),
      ),
    );
  const importPowerPoint = overrides.importPowerPoint ?? vi.fn(() => Promise.resolve(project));
  const resolveAndDownloadFonts =
    overrides.resolveAndDownloadFonts ??
    vi.fn(() =>
      Promise.resolve({
        fonts: {
          orbitron: {
            id: 'orbitron',
            family: 'Orbitron',
            requestedFamily: 'Orbitron',
            source: 'google-fonts' as const,
            fontStyle: 'normal' as const,
            fontWeight: 700,
            mimeType: 'font/woff2' as const,
            fileName: 'orbitron.woff2',
            storage: 'remote' as const,
          },
        },
        resolutions: [
          {
            requestedFamily: 'Orbitron',
            family: 'Orbitron',
            fontStyle: 'normal' as const,
            fontWeight: 700,
            status: 'downloaded-exact' as const,
          },
          {
            requestedFamily: 'Open Sans',
            family: 'Open Sans',
            fontStyle: 'normal' as const,
            fontWeight: 400,
            status: 'available-system' as const,
          },
        ],
        warnings: [],
      }),
    );
  const loadProjectFonts = vi.fn(() => Promise.resolve());
  const applyProject = vi.fn(() => undefined);
  const normalizeProject = vi.fn((candidate: ProjectDocument) => ({
    ...candidate,
    name: `${candidate.name} normalized`,
  }));
  const reports: Array<Record<string, unknown>> = [];
  const service = new PowerPointUrlImportService({
    applyProject,
    fetch: requestFetch,
    fontImportService: {
      listDownloadableFonts: () => [],
      loadProjectFonts,
      resolveAndDownloadFonts,
    },
    maxFileSizeBytes: overrides.maxFileSizeBytes,
    maxWarnings: overrides.maxWarnings,
    normalizeProject,
    presentationImportService: { importPowerPoint },
  });
  return {
    applyProject,
    importPowerPoint,
    loadProjectFonts,
    reports,
    requestFetch,
    resolveAndDownloadFonts,
    run: (input: { url: string; fileName?: string }) =>
      service.importPowerPointFromUrl(input, (report) => reports.push(report)),
  };
}

describe('PowerPointUrlImportService', () => {
  it('downloads a presigned MinIO URL and reuses import, font, normalization, and apply workflows', async () => {
    const requestFetch = vi.fn(() =>
      Promise.resolve(
        createResponse(new Uint8Array([80, 75, 3, 4]), {
          contentDisposition: `attachment; filename*=UTF-8''agent%20deck.pptx`,
          contentLength: '4',
          contentType: 'application/octet-stream',
        }),
      ),
    );
    const harness = createHarness({ fetch: requestFetch });

    await expect(
      harness.run({
        url: 'https://minio.example/presentations/object?X-Amz-Signature=secret',
      }),
    ).resolves.toMatchObject({
      downloadedBytes: 4,
      fileName: 'agent deck.pptx',
      pageCount: 2,
      projectId: 'project-imported',
      resolvedFontCount: 2,
      warnings: [],
    });
    expect(requestFetch).toHaveBeenCalledWith(
      'https://minio.example/presentations/object?X-Amz-Signature=secret',
      expect.objectContaining({ credentials: 'omit', method: 'GET', mode: 'cors' }),
    );
    const importedFile = vi.mocked(harness.importPowerPoint).mock.calls[0]?.[0].file;
    expect(importedFile).toMatchObject({ name: 'agent deck.pptx', size: 4, type: pptxMimeType });
    expect(harness.resolveAndDownloadFonts).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ family: 'Orbitron' })]),
    );
    expect(harness.loadProjectFonts).toHaveBeenCalledOnce();
    expect(harness.applyProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Untitled AI Deck normalized' }),
    );
    expect(harness.reports.map((report) => report.stage)).toEqual(
      expect.arrayContaining([
        'downloading-powerpoint',
        'importing-package',
        'extracting-objects',
        'resolving-fonts',
        'opening-presentation',
      ]),
    );
    expect(harness.reports).toContainEqual(
      expect.objectContaining({ current: 2, stage: 'extracting-objects', total: 2 }),
    );
  });

  it('accepts localhost HTTP URLs and explicit safe filenames', async () => {
    const harness = createHarness();

    await expect(
      harness.run({ url: 'http://localhost:8000/download?id=deck', fileName: 'local.pptx' }),
    ).resolves.toMatchObject({ fileName: 'local.pptx' });
  });

  it.each([
    ['not a URL', 'invalid-url'],
    ['file:///tmp/deck.pptx', 'invalid-url'],
    ['https://user:password@example.com/deck.pptx', 'invalid-url'],
  ])('rejects unsupported URL %s', async (url, reason) => {
    const harness = createHarness();

    await expect(harness.run({ url })).rejects.toThrow(reason);
    expect(harness.requestFetch).not.toHaveBeenCalled();
  });

  it('rejects an unsafe or non-PPTX filename', async () => {
    const harness = createHarness();

    await expect(
      harness.run({ url: 'https://example.com/download', fileName: '../deck.pptx' }),
    ).rejects.toThrow('invalid-filename');
    expect(harness.importPowerPoint).not.toHaveBeenCalled();
  });

  it.each([undefined, 'text/plain'])('rejects an invalid content type %s', async (contentType) => {
    const harness = createHarness({
      fetch: vi.fn(() =>
        Promise.resolve(
          createResponse(undefined, contentType === undefined ? {} : { contentType }),
        ),
      ),
    });

    await expect(harness.run({ url: 'https://example.com/deck.pptx' })).rejects.toThrow(
      'invalid-content-type',
    );
    expect(harness.importPowerPoint).not.toHaveBeenCalled();
  });

  it('reports an expired presigned URL without trying to parse its body', async () => {
    const harness = createHarness({
      fetch: vi.fn(() =>
        Promise.resolve(createResponse('expired', { contentType: 'text/plain', status: 403 })),
      ),
    });

    await expect(harness.run({ url: 'https://minio.example/deck.pptx?expired=1' })).rejects.toThrow(
      'HTTP 403',
    );
    expect(harness.importPowerPoint).not.toHaveBeenCalled();
  });

  it.each(['Failed to fetch', 'Blocked by CORS policy'])(
    'normalizes unreachable and CORS fetch failures: %s',
    async (message) => {
      const harness = createHarness({
        fetch: vi.fn(() => Promise.reject(new TypeError(message))),
      });

      await expect(harness.run({ url: 'https://example.com/deck.pptx' })).rejects.toThrow(
        'network-or-cors',
      );
      expect(harness.importPowerPoint).not.toHaveBeenCalled();
    },
  );

  it('rejects a declared oversize response before buffering it', async () => {
    const harness = createHarness({
      fetch: vi.fn(() =>
        Promise.resolve(
          createResponse(undefined, { contentLength: '5', contentType: pptxMimeType }),
        ),
      ),
      maxFileSizeBytes: 4,
    });

    await expect(harness.run({ url: 'https://example.com/deck.pptx' })).rejects.toThrow(
      'file-too-large',
    );
    expect(harness.importPowerPoint).not.toHaveBeenCalled();
  });

  it('enforces the actual streamed size when content-length is absent', async () => {
    const harness = createHarness({
      fetch: vi.fn(() =>
        Promise.resolve(
          createResponse(new Uint8Array([1, 2, 3, 4, 5]), { contentType: pptxMimeType }),
        ),
      ),
      maxFileSizeBytes: 4,
    });

    await expect(harness.run({ url: 'https://example.com/deck.pptx' })).rejects.toThrow(
      'file-too-large',
    );
  });

  it('does not apply a project when the native parser rejects a corrupt package', async () => {
    const harness = createHarness({
      importPowerPoint: vi.fn(() =>
        Promise.reject(new Error('ZIP central directory was not found')),
      ),
    });

    await expect(harness.run({ url: 'https://example.com/corrupt.pptx' })).rejects.toThrow(
      'invalid-package): ZIP central directory was not found',
    );
    expect(harness.applyProject).not.toHaveBeenCalled();
  });

  it('bounds warnings in the final result and operation progress', async () => {
    const warnings = Array.from(
      { length: 5 },
      (_, index): ImportWarning => ({
        code: `warning-${index}`,
        message: `Warning ${index}`,
        severity: 'warning',
      }),
    );
    const harness = createHarness({ maxWarnings: 3, project: createImportedProject(warnings) });

    const result = await harness.run({ url: 'https://example.com/deck.pptx' });

    expect(result.warnings).toHaveLength(3);
    expect(result.warnings.at(-1)?.code).toBe('warnings-truncated');
    expect(harness.reports.at(-1)?.warnings).toHaveLength(3);
  });

  it('keeps importing when Google Font resolution fails', async () => {
    const harness = createHarness({
      resolveAndDownloadFonts: vi.fn(() => Promise.reject(new Error('offline'))),
    });

    await expect(harness.run({ url: 'https://example.com/deck.pptx' })).resolves.toMatchObject({
      resolvedFontCount: 0,
      warnings: [expect.objectContaining({ code: 'font-download-failed' })],
    });
    expect(harness.applyProject).toHaveBeenCalledOnce();
  });
});
