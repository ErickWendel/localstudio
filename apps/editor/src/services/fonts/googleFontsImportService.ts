import type { ImportWarning, ProjectDocument, ProjectFont } from '../../domain/documents/model';
import type {
  FontImportRequest,
  FontImportResult,
  FontImportService,
  FontResolution,
} from '../contracts/interfaces';
import { googleFontsCatalog } from './googleFontsCatalog';

interface BrowserGoogleFontsImportServiceOptions {
  fetch?: typeof fetch;
  fontFaceConstructor?: typeof FontFace;
  fontSet?: FontFaceSet;
}

const GOOGLE_FONTS_CSS_ORIGIN = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_FILE_ORIGIN = 'https://fonts.gstatic.com';

function getDefaultFetch() {
  if (typeof window !== 'undefined') return window.fetch.bind(window);
  return globalThis.fetch.bind(globalThis);
}

function createFontId(request: FontImportRequest) {
  const slug = request.family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return `google-fonts-${slug || 'font'}-${request.fontStyle}-${request.fontWeight}`;
}

function encodeGoogleFontFamily(request: FontImportRequest) {
  const family = encodeURIComponent(request.family).replaceAll('%20', '+');
  if (request.fontStyle === 'italic') return `${family}:ital,wght@1,${request.fontWeight}`;
  return `${family}:wght@${request.fontWeight}`;
}

function createCssUrl(request: FontImportRequest) {
  return `${GOOGLE_FONTS_CSS_ORIGIN}/css2?family=${encodeGoogleFontFamily(request)}&display=swap`;
}

function getCssProperty(block: string, property: string) {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1]?.trim().replace(/^["']|["']$/g, '');
}

function getCssFontUrl(block: string) {
  const match = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+?\.woff2)\)/);
  return match?.[1];
}

function isAllowedFontUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === GOOGLE_FONTS_FILE_ORIGIN && url.pathname.endsWith('.woff2');
  } catch {
    return false;
  }
}

function fontWeightMatches(cssWeight: string | undefined, requestedWeight: number) {
  if (!cssWeight) return true;
  const weights = cssWeight
    .split(/\s+/)
    .map((weight) => Number(weight))
    .filter(Number.isFinite);
  if (weights.length === 0) return true;
  if (weights.length === 1) return weights[0] === requestedWeight;
  const minimum = weights[0] ?? requestedWeight;
  const maximum = weights[1] ?? minimum;
  return requestedWeight >= minimum && requestedWeight <= maximum;
}

function extractWoff2Url(css: string, request: FontImportRequest) {
  const blocks = Array.from(css.matchAll(/@font-face\s*{([^}]+)}/gi)).map((match) => match[1] ?? '');
  const matchingBlock = blocks.find((block) => {
    const style = getCssProperty(block, 'font-style');
    const weight = getCssProperty(block, 'font-weight');
    return (!style || style === request.fontStyle) && fontWeightMatches(weight, request.fontWeight);
  });
  const matchedUrl = matchingBlock ? getCssFontUrl(matchingBlock) : undefined;
  if (matchedUrl) return matchedUrl;
  return blocks.map(getCssFontUrl).find((url): url is string => Boolean(url));
}

function createWarning(request: FontImportRequest, reason: string, code = 'font-download-failed'): ImportWarning {
  return {
    code,
    message: `Could not download ${request.family} ${request.fontWeight}: ${reason}`,
    severity: 'warning',
  };
}

function createMissingWarning(request: FontImportRequest): ImportWarning {
  return {
    code: 'font-missing',
    message: `${request.family} is not available locally and no downloadable match is configured. Replace it or upload the font to preserve the PowerPoint design.`,
    severity: 'warning',
  };
}

function createSubstitutionWarning(request: FontImportRequest, family: string): ImportWarning {
  return {
    code: 'font-substituted',
    message: `Using ${family} as a compatible substitute for ${request.family}.`,
    severity: 'info',
  };
}

function getFontFaceConstructor(options: BrowserGoogleFontsImportServiceOptions) {
  return options.fontFaceConstructor ?? (typeof FontFace !== 'undefined' ? FontFace : undefined);
}

function getFontSet(options: BrowserGoogleFontsImportServiceOptions) {
  return options.fontSet ?? (typeof document !== 'undefined' ? document.fonts : undefined);
}

function escapeFontFamily(family: string) {
  return family.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export class BrowserGoogleFontsImportService implements FontImportService {
  private readonly requestFetch: typeof fetch;
  private readonly downloadableFamilies = new Map<string, { family: string; exact: boolean }>();

  constructor(private readonly options: BrowserGoogleFontsImportServiceOptions = {}) {
    this.requestFetch = options.fetch ?? getDefaultFetch();
    for (const font of googleFontsCatalog) {
      this.downloadableFamilies.set(font.family.toLowerCase(), { exact: true, family: font.family });
      for (const alias of font.aliases ?? []) {
        this.downloadableFamilies.set(alias.toLowerCase(), { exact: false, family: font.family });
      }
    }
  }

  async resolveAndDownloadFonts(requests: FontImportRequest[]): Promise<FontImportResult> {
    const fonts: Record<string, ProjectFont> = {};
    const resolutions: FontResolution[] = [];
    const warnings: ImportWarning[] = [];
    for (const request of requests) {
      const result = await this.downloadFont(request);
      if ('font' in result) {
        fonts[result.font.id] = result.font;
      }
      resolutions.push(result.resolution);
      if ('warning' in result) {
        warnings.push(result.warning);
      }
    }
    await this.loadProjectFonts({ fonts } as ProjectDocument);
    return { fonts, resolutions, warnings };
  }

  listDownloadableFonts() {
    return googleFontsCatalog;
  }

  async loadProjectFonts(project: ProjectDocument): Promise<void> {
    const FontFaceConstructor = getFontFaceConstructor(this.options);
    const fontSet = getFontSet(this.options);
    if (!FontFaceConstructor || !fontSet) return;
    const fonts = Object.values(project.fonts ?? {}).filter((font) => font.objectUrl);
    await Promise.all(
      fonts.map(async (font) => {
        const face = new FontFaceConstructor(font.family, `url(${font.objectUrl})`, {
          style: font.fontStyle,
          weight: String(font.fontWeight),
        });
        await face.load();
        fontSet.add(face);
      }),
    );
  }

  private async downloadFont(
    request: FontImportRequest,
  ): Promise<
    | { font: ProjectFont; resolution: FontResolution; warning?: ImportWarning }
    | { resolution: FontResolution }
    | { resolution: FontResolution; warning: ImportWarning }
  > {
    const localResolution = this.resolveLocalFont(request);
    if (localResolution) return { resolution: localResolution };

    const catalogMatch = this.downloadableFamilies.get(request.family.toLowerCase());
    if (!catalogMatch) {
      return {
        resolution: {
          fontStyle: request.fontStyle,
          fontWeight: request.fontWeight,
          message: `${request.family} is missing and needs a replacement or uploaded font file.`,
          requestedFamily: request.family,
          status: 'missing-needs-user',
        },
        warning: createMissingWarning(request),
      };
    }
    const normalizedRequest = { ...request, family: catalogMatch.family };
    const cssResponse = await this.requestFetch(createCssUrl(normalizedRequest), {
      headers: { Accept: 'text/css' },
    });
    if (!cssResponse.ok) {
      return {
        resolution: {
          family: normalizedRequest.family,
          fontStyle: normalizedRequest.fontStyle,
          fontWeight: normalizedRequest.fontWeight,
          message: `Google Fonts returned ${cssResponse.status}.`,
          requestedFamily: request.family,
          status: 'failed',
        },
        warning: createWarning(normalizedRequest, `Google Fonts returned ${cssResponse.status}`),
      };
    }

    const fontUrl = extractWoff2Url(await cssResponse.text(), normalizedRequest);
    if (!fontUrl || !isAllowedFontUrl(fontUrl)) {
      return {
        resolution: {
          family: normalizedRequest.family,
          fontStyle: normalizedRequest.fontStyle,
          fontWeight: normalizedRequest.fontWeight,
          message: 'No downloadable WOFF2 file was found.',
          requestedFamily: request.family,
          status: 'failed',
        },
        warning: createWarning(normalizedRequest, 'no downloadable woff2 file was found'),
      };
    }

    const fontResponse = await this.requestFetch(fontUrl, { headers: { Accept: 'font/woff2' } });
    if (!fontResponse.ok) {
      return {
        resolution: {
          family: normalizedRequest.family,
          fontStyle: normalizedRequest.fontStyle,
          fontWeight: normalizedRequest.fontWeight,
          message: `Font file returned ${fontResponse.status}.`,
          requestedFamily: request.family,
          status: 'failed',
        },
        warning: createWarning(normalizedRequest, `font file returned ${fontResponse.status}`),
      };
    }

    const blob = await fontResponse.blob();
    const id = createFontId(normalizedRequest);
    const status = catalogMatch.exact ? 'downloaded-exact' : 'downloaded-compatible';
    const resolution: FontResolution = {
      family: normalizedRequest.family,
      fontStyle: normalizedRequest.fontStyle,
      fontWeight: normalizedRequest.fontWeight,
      requestedFamily: request.family,
      status,
    };
    return {
      font: {
        id,
        family: normalizedRequest.family,
        requestedFamily: request.family,
        source: 'google-fonts',
        fontStyle: normalizedRequest.fontStyle,
        fontWeight: normalizedRequest.fontWeight,
        mimeType: 'font/woff2',
        fileName: `${id}.woff2`,
        storage: 'inline',
        objectUrl: URL.createObjectURL(blob),
        sourceUrl: fontUrl,
      },
      resolution,
      ...(!catalogMatch.exact ? { warning: createSubstitutionWarning(request, normalizedRequest.family) } : {}),
    };
  }

  private resolveLocalFont(request: FontImportRequest): FontResolution | undefined {
    const fontSet = getFontSet(this.options);
    if (!fontSet || typeof fontSet.check !== 'function') return undefined;
    try {
      const descriptor = `${request.fontStyle} ${request.fontWeight} 16px "${escapeFontFamily(request.family)}"`;
      if (!fontSet.check(descriptor)) return undefined;
      return {
        family: request.family,
        fontStyle: request.fontStyle,
        fontWeight: request.fontWeight,
        requestedFamily: request.family,
        status: 'available-system',
      };
    } catch {
      return undefined;
    }
  }
}
