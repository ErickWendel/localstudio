import type { ImportWarning, ProjectDocument, ProjectFont } from '../../domain/documents/model';
import type { FontImportRequest, FontImportResult, FontImportService } from '../contracts/interfaces';
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

function extractWoff2Url(css: string) {
  const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+?\.woff2)\)/);
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

function createWarning(request: FontImportRequest, reason: string, code = 'font-download-failed'): ImportWarning {
  return {
    code,
    message: `Could not download ${request.family} ${request.fontWeight}: ${reason}`,
    severity: 'warning',
  };
}

function getFontFaceConstructor(options: BrowserGoogleFontsImportServiceOptions) {
  return options.fontFaceConstructor ?? (typeof FontFace !== 'undefined' ? FontFace : undefined);
}

function getFontSet(options: BrowserGoogleFontsImportServiceOptions) {
  return options.fontSet ?? (typeof document !== 'undefined' ? document.fonts : undefined);
}

export class BrowserGoogleFontsImportService implements FontImportService {
  private readonly requestFetch: typeof fetch;
  private readonly downloadableFamilies = new Map(
    googleFontsCatalog.map((font) => [font.family.toLowerCase(), font.family]),
  );

  constructor(private readonly options: BrowserGoogleFontsImportServiceOptions = {}) {
    this.requestFetch = options.fetch ?? getDefaultFetch();
  }

  async resolveAndDownloadFonts(requests: FontImportRequest[]): Promise<FontImportResult> {
    const fonts: Record<string, ProjectFont> = {};
    const warnings: ImportWarning[] = [];
    for (const request of requests) {
      const result = await this.downloadFont(request);
      if ('font' in result) {
        fonts[result.font.id] = result.font;
      } else {
        warnings.push(result.warning);
      }
    }
    await this.loadProjectFonts({ fonts } as ProjectDocument);
    return { fonts, warnings };
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
  ): Promise<{ font: ProjectFont } | { warning: ImportWarning }> {
    const catalogFamily = this.downloadableFamilies.get(request.family.toLowerCase());
    if (!catalogFamily) {
      return {
        warning: createWarning(
          request,
          'font family is not in the local Google Fonts catalog',
          'font-download-unavailable',
        ),
      };
    }
    const normalizedRequest = { ...request, family: catalogFamily };
    const cssResponse = await this.requestFetch(createCssUrl(normalizedRequest), {
      headers: { Accept: 'text/css' },
    });
    if (!cssResponse.ok) {
      return { warning: createWarning(normalizedRequest, `Google Fonts returned ${cssResponse.status}`) };
    }

    const fontUrl = extractWoff2Url(await cssResponse.text());
    if (!fontUrl || !isAllowedFontUrl(fontUrl)) {
      return { warning: createWarning(normalizedRequest, 'no downloadable woff2 file was found') };
    }

    const fontResponse = await this.requestFetch(fontUrl, { headers: { Accept: 'font/woff2' } });
    if (!fontResponse.ok) {
      return { warning: createWarning(normalizedRequest, `font file returned ${fontResponse.status}`) };
    }

    const blob = await fontResponse.blob();
    const id = createFontId(normalizedRequest);
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
    };
  }
}
