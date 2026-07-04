import { describe, expect, it, vi } from 'vitest';
import { BrowserGoogleFontsImportService } from '../../../src/services/fonts/googleFontsImportService';

describe('BrowserGoogleFontsImportService', () => {
  function getRequestUrl(input: RequestInfo | URL) {
    if (input instanceof Request) return input.url;
    if (input instanceof URL) return input.toString();
    return input;
  }

  it('downloads matching Google Fonts woff2 files and registers them in the browser', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url.startsWith('https://fonts.googleapis.com/css2')) {
        expect(url).toContain('family=Montserrat:wght@700');
        return Promise.resolve(
          new Response(
            `@font-face {
              font-family: 'Montserrat';
              font-style: normal;
              font-weight: 700;
              src: url(https://fonts.gstatic.com/s/montserrat/v31/montserrat-700.woff2) format('woff2');
            }`,
            { status: 200, headers: { 'content-type': 'text/css' } },
          ),
        );
      }
      if (url === 'https://fonts.gstatic.com/s/montserrat/v31/montserrat-700.woff2') {
        return Promise.resolve(
          new Response(new TextEncoder().encode('font'), {
            status: 200,
            headers: { 'content-type': 'font/woff2' },
          }),
        );
      }
      return Promise.resolve(new Response('', { status: 404 }));
    });
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:font');

    const service = new BrowserGoogleFontsImportService({
      fetch: fetchMock,
      fontFaceConstructor: class {
        constructor(
          readonly family: string,
          readonly source: string,
          readonly descriptors: FontFaceDescriptors,
        ) {}

        load(): Promise<FontFace> {
          return Promise.resolve(this as unknown as FontFace);
        }
      } as unknown as typeof FontFace,
      fontSet: { add: vi.fn() } as unknown as FontFaceSet,
    });

    const result = await service.resolveAndDownloadFonts([
      { family: 'Montserrat', fontStyle: 'normal', fontWeight: 700 },
    ]);

    expect(result.fonts).toMatchObject({
      'google-fonts-montserrat-normal-700': {
        family: 'Montserrat',
        fileName: 'google-fonts-montserrat-normal-700.woff2',
        fontWeight: 700,
        mimeType: 'font/woff2',
        objectUrl: 'blob:font',
        source: 'google-fonts',
        storage: 'inline',
      },
    });
    expect(result.warnings).toEqual([]);
    expect(createObjectUrl).toHaveBeenCalled();
  });

  it('returns a warning instead of failing when Google Fonts has no exact match', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('', { status: 400 })));
    const service = new BrowserGoogleFontsImportService({
      fetch: fetchMock,
    });

    const result = await service.resolveAndDownloadFonts([
      { family: 'Missing Font', fontStyle: 'normal', fontWeight: 400 },
    ]);

    expect(result.fonts).toEqual({});
    expect(result.warnings[0]?.message).toContain('Missing Font');
    expect(result.warnings).toMatchObject([
      { code: 'font-download-unavailable', severity: 'warning' },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not request Google CSS for unsupported PowerPoint font names', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('', { status: 200 })));
    const service = new BrowserGoogleFontsImportService({ fetch: fetchMock });

    const result = await service.resolveAndDownloadFonts([
      { family: 'Adobe 고딕 Std B', fontStyle: 'normal', fontWeight: 400 },
    ]);

    expect(result.fonts).toEqual({});
    expect(result.warnings[0]?.message).toContain('Adobe 고딕 Std B');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a searchable list of downloadable fonts', () => {
    const service = new BrowserGoogleFontsImportService();

    expect(service.listDownloadableFonts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: 'Montserrat', source: 'google-fonts' }),
        expect.objectContaining({ family: 'Noto Sans KR', source: 'google-fonts' }),
        expect.objectContaining({ aliases: ['Arial', 'Helvetica'], family: 'Arimo' }),
      ]),
    );
  });
});
