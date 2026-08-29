import type { ImportWarning, ProjectDocument } from '../../domain/documents/model';
import type { FontImportService, PresentationImportService } from '../contracts/interfaces';
import { pptxFontRequests } from '../importing/pptx/pptxFontRequests';
import type { AuthoringProgressReporter } from './authoringAutomationController';

export interface PowerPointUrlImportInput {
  url: string;
  fileName?: string | undefined;
}

export interface PowerPointUrlImportResult {
  projectId: string;
  pageCount: number;
  resolvedFontCount: number;
  downloadedBytes: number;
  fileName: string;
  warnings: ImportWarning[];
}

export interface PowerPointUrlImportServiceOptions {
  applyProject(project: ProjectDocument): Promise<void> | void;
  fontImportService: FontImportService;
  presentationImportService: PresentationImportService;
  fetch?: typeof fetch | undefined;
  maxFileSizeBytes?: number | undefined;
  maxWarnings?: number | undefined;
  normalizeProject?: ((project: ProjectDocument) => ProjectDocument) | undefined;
}

const powerPointMimeType =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const acceptedMimeTypes = new Set([powerPointMimeType, 'application/octet-stream']);
const defaultMaxWarnings = 20;
const maxWarningMessageLength = 500;

function fail(reason: string, message: string): never {
  throw new Error(`PowerPoint URL import failed (${reason}): ${message}`);
}

function parseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return fail('invalid-url', 'Provide a valid absolute HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return fail('invalid-url', 'Only HTTP and HTTPS URLs are supported.');
  }
  if (url.username || url.password) {
    return fail('invalid-url', 'URLs containing embedded credentials are not supported.');
  }
  return url;
}

function decodeFileName(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getContentDispositionFileName(value: string | null) {
  if (!value) return undefined;
  const fields = value.split(';').map((field) => field.trim());
  const encoded = fields.find((field) => /^filename\*=/i.test(field));
  if (encoded) {
    const raw = encoded
      .slice(encoded.indexOf('=') + 1)
      .trim()
      .replace(/^"|"$/g, '');
    return decodeFileName(raw.replace(/^UTF-8''/i, ''));
  }
  const basic = fields.find((field) => /^filename=/i.test(field));
  return basic
    ?.slice(basic.indexOf('=') + 1)
    .trim()
    .replace(/^"|"$/g, '');
}

function validateFileName(value: string | undefined) {
  const fileName = value?.trim();
  if (
    !fileName ||
    fileName.length > 255 ||
    /[\\/\0\r\n]/.test(fileName) ||
    !fileName.toLowerCase().endsWith('.pptx')
  ) {
    return fail('invalid-filename', 'The remote file name must be a safe .pptx file name.');
  }
  return fileName;
}

function resolveFileName(input: PowerPointUrlImportInput, url: URL, response: Response) {
  if (input.fileName !== undefined) return validateFileName(input.fileName);
  const dispositionName = getContentDispositionFileName(
    response.headers.get('content-disposition'),
  );
  if (dispositionName) return validateFileName(dispositionName);
  const pathName = decodeFileName(url.pathname.split('/').at(-1) ?? '');
  return validateFileName(pathName);
}

function validateContentType(response: Response) {
  const contentType = response.headers.get('content-type')?.split(';').at(0)?.trim().toLowerCase();
  if (!contentType || !acceptedMimeTypes.has(contentType)) {
    return fail(
      'invalid-content-type',
      `Expected ${powerPointMimeType} or application/octet-stream.`,
    );
  }
  return contentType;
}

function parseContentLength(response: Response) {
  const raw = response.headers.get('content-length');
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function toBlobPart(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function readBoundedResponse(
  response: Response,
  maxBytes: number | undefined,
  report: AuthoringProgressReporter,
) {
  const declaredBytes = parseContentLength(response);
  if (maxBytes !== undefined && declaredBytes !== undefined && declaredBytes > maxBytes) {
    return fail('file-too-large', `The file exceeds the ${maxBytes.toLocaleString()} byte limit.`);
  }
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (maxBytes !== undefined && buffer.byteLength > maxBytes) {
      return fail(
        'file-too-large',
        `The file exceeds the ${maxBytes.toLocaleString()} byte limit.`,
      );
    }
    report({
      loadedBytes: buffer.byteLength,
      ...(declaredBytes !== undefined ? { totalBytes: declaredBytes } : {}),
      progress: 45,
    });
    return { bytes: [buffer], loadedBytes: buffer.byteLength, totalBytes: declaredBytes };
  }

  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let loadedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      loadedBytes += value.byteLength;
      if (maxBytes !== undefined && loadedBytes > maxBytes) {
        await reader.cancel('PowerPoint file exceeds configured size limit.');
        return fail(
          'file-too-large',
          `The file exceeds the ${maxBytes.toLocaleString()} byte limit.`,
        );
      }
      chunks.push(toBlobPart(value));
      const downloadProgress = declaredBytes
        ? 5 + Math.min(40, Math.round((loadedBytes / declaredBytes) * 40))
        : Math.min(44, 5 + Math.floor(loadedBytes / (1024 * 1024)));
      report({
        stage: 'downloading-powerpoint',
        progress: downloadProgress,
        loadedBytes,
        ...(declaredBytes !== undefined ? { totalBytes: declaredBytes } : {}),
      });
    }
  } finally {
    reader.releaseLock();
  }
  return { bytes: chunks, loadedBytes, totalBytes: declaredBytes };
}

function boundedWarnings(warnings: ImportWarning[], maximum: number) {
  const normalized = warnings.map((warning) => ({
    ...warning,
    message:
      warning.message.length > maxWarningMessageLength
        ? `${warning.message.slice(0, maxWarningMessageLength)}…`
        : warning.message,
  }));
  if (normalized.length <= maximum) return normalized;
  return [
    ...normalized.slice(0, Math.max(0, maximum - 1)),
    {
      code: 'warnings-truncated',
      message: `${(normalized.length - maximum + 1).toLocaleString()} additional import warnings were omitted.`,
      severity: 'info' as const,
    },
  ];
}

function getDefaultFetch() {
  if (typeof window !== 'undefined') return window.fetch.bind(window);
  return globalThis.fetch.bind(globalThis);
}

export class PowerPointUrlImportService {
  private readonly requestFetch: typeof fetch;
  private readonly maxFileSizeBytes: number | undefined;
  private readonly maxWarnings: number;

  constructor(private readonly options: PowerPointUrlImportServiceOptions) {
    this.requestFetch = options.fetch ?? getDefaultFetch();
    this.maxFileSizeBytes = options.maxFileSizeBytes;
    this.maxWarnings = options.maxWarnings ?? defaultMaxWarnings;
    if (
      this.maxFileSizeBytes !== undefined &&
      (!Number.isSafeInteger(this.maxFileSizeBytes) || this.maxFileSizeBytes < 1)
    ) {
      throw new Error('maxFileSizeBytes must be a positive safe integer.');
    }
    if (!Number.isSafeInteger(this.maxWarnings) || this.maxWarnings < 1) {
      throw new Error('maxWarnings must be a positive safe integer.');
    }
  }

  async importPowerPointFromUrl(
    input: PowerPointUrlImportInput,
    report: AuthoringProgressReporter,
  ): Promise<PowerPointUrlImportResult> {
    const url = parseUrl(input.url);
    report({ stage: 'downloading-powerpoint', progress: 5, detail: 'Fetching PowerPoint file.' });

    let response: Response;
    try {
      response = await this.requestFetch(url.toString(), {
        credentials: 'omit',
        headers: { Accept: `${powerPointMimeType}, application/octet-stream` },
        method: 'GET',
        mode: 'cors',
        redirect: 'follow',
      });
    } catch {
      return fail(
        'network-or-cors',
        'The file could not be fetched. It may be unreachable or blocked by CORS.',
      );
    }
    if (!response.ok) {
      return fail('http-status', `The remote server returned HTTP ${response.status}.`);
    }

    const contentType = validateContentType(response);
    const fileName = resolveFileName(input, url, response);
    const download = await readBoundedResponse(response, this.maxFileSizeBytes, report);
    const file = new File(download.bytes, fileName, {
      type: contentType === 'application/octet-stream' ? powerPointMimeType : contentType,
    });

    report({
      stage: 'importing-package',
      progress: 50,
      loadedBytes: download.loadedBytes,
      ...(download.totalBytes !== undefined ? { totalBytes: download.totalBytes } : {}),
      detail: 'Parsing the PowerPoint package.',
    });
    let importedProject: ProjectDocument;
    try {
      importedProject = await this.options.presentationImportService.importPowerPoint({ file });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'The PowerPoint package is invalid.';
      return fail('invalid-package', detail);
    }

    report({
      stage: 'extracting-objects',
      progress: 70,
      current: importedProject.pages.length,
      total: importedProject.pages.length,
      detail: `Extracted objects from ${importedProject.pages.length.toLocaleString()} slides.`,
    });
    const fontRequests = pptxFontRequests.collect(importedProject);
    report({
      stage: 'resolving-fonts',
      progress: 80,
      current: 0,
      total: fontRequests.length,
      detail: `Resolving ${fontRequests.length.toLocaleString()} referenced fonts.`,
    });
    const fontResult = await this.options.fontImportService
      .resolveAndDownloadFonts(fontRequests)
      .catch(() => ({
        fonts: {},
        resolutions: [],
        warnings: [
          {
            code: 'font-download-failed',
            message: 'Could not download one or more imported PowerPoint fonts.',
            severity: 'warning' as const,
          },
        ],
      }));
    const projectWithFonts: ProjectDocument = {
      ...importedProject,
      fonts: { ...(importedProject.fonts ?? {}), ...fontResult.fonts },
      ...((importedProject.importWarnings?.length ?? 0) > 0 || fontResult.warnings.length > 0
        ? {
            importWarnings: [...(importedProject.importWarnings ?? []), ...fontResult.warnings],
          }
        : {}),
    };
    const normalizedProject = this.options.normalizeProject?.(projectWithFonts) ?? projectWithFonts;
    await this.options.fontImportService.loadProjectFonts(normalizedProject);
    const warnings = boundedWarnings(normalizedProject.importWarnings ?? [], this.maxWarnings);
    report({
      stage: 'opening-presentation',
      progress: 95,
      current: normalizedProject.pages.length,
      total: normalizedProject.pages.length,
      loadedBytes: download.loadedBytes,
      ...(download.totalBytes !== undefined ? { totalBytes: download.totalBytes } : {}),
      warnings: warnings.map((warning) => warning.message),
      detail: 'Opening the imported presentation.',
    });
    await this.options.applyProject(normalizedProject);

    return {
      projectId: normalizedProject.id,
      pageCount: normalizedProject.pages.length,
      resolvedFontCount: fontResult.resolutions.filter(
        (resolution) =>
          resolution.status === 'available-system' ||
          resolution.status === 'downloaded-exact' ||
          resolution.status === 'downloaded-compatible',
      ).length,
      downloadedBytes: download.loadedBytes,
      fileName,
      warnings,
    };
  }
}
