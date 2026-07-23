import type { ProjectDocument, TextElement } from '../../../apps/editor/src/domain/documents/model';

export type FontServiceContractResult = {
  googleFontIds: string[];
  googleResolutionStatuses: string[];
  googleWarningCodes: string[];
  localAddedFamilies: string[];
  localMissingWarnings: string[];
  localProgress: string[];
  missingFolderWarning: string | undefined;
  testFontWarning: string | undefined;
};

function createTextElement(
  id: string,
  fontFamily: string,
  fontWeight: number,
): TextElement {
  return {
    align: 'left',
    fill: '#111827',
    fontFamily,
    fontSize: 36,
    fontWeight,
    height: 80,
    id,
    opacity: 1,
    rotation: 0,
    text: fontFamily,
    type: 'text',
    width: 320,
    x: 0,
    y: 0,
  };
}

export function createFontContractProject(): ProjectDocument {
  return {
    assets: {},
    createdAt: '2026-07-22T00:00:00.000Z',
    elements: {
      'project-regular': createTextElement('project-regular', 'Project Sans', 400),
      'project-bold': createTextElement('project-bold', 'Project Sans', 800),
    },
    fonts: {},
    id: 'font-contract-project',
    name: 'Font Contract',
    pageOrder: ['page-1'],
    pages: {
      'page-1': {
        background: { color: '#ffffff', type: 'color' },
        elementIds: ['project-regular', 'project-bold'],
        height: 1080,
        id: 'page-1',
        name: 'Fonts',
        visible: true,
        width: 1920,
      },
    },
    slideLayouts: {
      'layout-1': {
        createdAt: '2026-07-22T00:00:00.000Z',
        elements: {
          'layout-title': createTextElement('layout-title', 'Layout Serif', 700),
        },
        id: 'layout-1',
        name: 'Layout',
        updatedAt: '2026-07-22T00:00:00.000Z',
      },
    },
    themeGallery: ['theme-1'],
    themeId: 'theme-1',
    themes: {
      'theme-1': {
        colors: {
          accent: '#2563eb',
          background: '#ffffff',
          primary: '#111827',
          secondary: '#64748b',
          surface: '#f8fafc',
          text: '#111827',
        },
        createdAt: '2026-07-22T00:00:00.000Z',
        id: 'theme-1',
        name: 'Theme',
        typography: {
          bodyFontFamily: 'Theme Body',
          headingFontFamily: 'Theme Heading',
        },
        updatedAt: '2026-07-22T00:00:00.000Z',
      },
    },
    updatedAt: '2026-07-22T00:00:00.000Z',
  };
}

export async function evaluateFontServiceContract(
  project: ProjectDocument,
): Promise<FontServiceContractResult> {
  const { BrowserGoogleFontsImportService } = (await import(
    '/editor/src/services/fonts/googleFontsImportService.ts'
  )) as typeof import('../../../apps/editor/src/services/fonts/googleFontsImportService');
  const { BrowserLocalFontMirrorService } = (await import(
    '/editor/src/services/fonts/localFontMirrorService.ts'
  )) as typeof import('../../../apps/editor/src/services/fonts/localFontMirrorService');

  const objectUrls: string[] = [];
  function createDirectoryHandle(files: File[]) {
    class ContractFileHandle {
      readonly kind = 'file';

      constructor(readonly name: string, private readonly file: File) {}

      async getFile() {
        await Promise.resolve();
        return this.file;
      }
    }

    return {
      kind: 'directory',
      name: 'Contract Fonts',
      async queryPermission() {
        await Promise.resolve();
        return 'granted' as PermissionState;
      },
      async requestPermission() {
        await Promise.resolve();
        return 'granted' as PermissionState;
      },
      async *entries(): AsyncIterable<[string, { kind: string; getFile?: () => Promise<File> }]> {
        for (const file of files) {
          await Promise.resolve();
          yield [file.name, new ContractFileHandle(file.name, file)];
        }
      },
    } as unknown as FileSystemDirectoryHandle;
  }

  const createObjectURL = (blob: Blob) => {
    const fileName = blob instanceof File ? blob.name : 'font.woff2';
    const objectUrl = `blob:font-contract/${fileName}/${objectUrls.length}`;
    objectUrls.push(objectUrl);
    return objectUrl;
  };
  const fetchFont: typeof fetch = async (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    await Promise.resolve();
    if (url.includes('family=Inter')) return new Response('missing', { status: 503 });
    if (url.includes('family=Lato')) {
      return new Response('@font-face { font-family: Lato; src: url(https://evil.example/lato.woff2); }');
    }
    if (url.includes('family=Roboto')) {
      return new Response(
        '@font-face { font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/roboto/v1/roboto.woff2); }',
      );
    }
    if (url.includes('family=Arimo')) {
      return new Response(
        '@font-face { font-style: italic; font-weight: 400 700; src: url(https://fonts.gstatic.com/s/arimo/v1/arimo.woff2); }',
      );
    }
    if (url.includes('fonts.gstatic.com/s/roboto')) {
      return new Response('not found', { status: 404 });
    }
    return new Response(new Blob(['font-bytes'], { type: 'font/woff2' }));
  };
  class ContractFontFace {
    constructor(
      readonly family: string,
      readonly source: string,
    ) {}

    async load() {
      await Promise.resolve();
      if (this.source.includes('Broken')) throw new Error('bad font');
      return this;
    }
  }
  const fontSet = { add() {} } as unknown as FontFaceSet;
  const googleFonts = new BrowserGoogleFontsImportService({
    fetch: fetchFont,
    fontAvailability: {
      isAvailable: (family) => family === 'System Contract',
    },
    fontFaceConstructor: ContractFontFace as unknown as typeof FontFace,
    fontSet,
  });
  const googleResult = await googleFonts.resolveAndDownloadFonts([
    { family: 'System Contract', fontStyle: 'normal', fontWeight: 400 },
    { family: 'Unknown Font', fontStyle: 'normal', fontWeight: 400 },
    { family: 'Inter', fontStyle: 'normal', fontWeight: 400 },
    { family: 'Lato', fontStyle: 'normal', fontWeight: 400 },
    { family: 'Roboto', fontStyle: 'normal', fontWeight: 400 },
    { family: 'Arial', fontStyle: 'italic', fontWeight: 700 },
  ]);

  window.localStorage.setItem('localstudio.ai.local-font-mirror.enabled', 'true');
  window.localStorage.removeItem('localstudio.ai.local-font-mirror.folder-label');
  const missingFolder = new BrowserLocalFontMirrorService({
    createObjectURL,
    now: () => new Date('2026-07-22T00:00:00.000Z'),
  });
  const missingFolderResult = await missingFolder.importProjectFonts(project);

  const directory = createDirectoryHandle([
    new File(['regular'], 'ProjectSans-Regular.woff2', { type: 'font/woff2' }),
    new File(['bold'], 'ProjectSans-Bold.woff2', { type: 'font/woff2' }),
    new File(['layout'], 'LayoutSerif-Bold.otf', { type: 'font/otf' }),
    new File(['broken'], 'Broken.ttf', { type: 'font/ttf' }),
  ]);
  const progress: string[] = [];
  const localFonts = new BrowserLocalFontMirrorService({
    createObjectURL,
    fontDirectoryHandle: directory,
    fontFaceConstructor: ContractFontFace as unknown as typeof FontFace,
    now: () => new Date('2026-07-22T00:00:00.000Z'),
  });
  const localResult = await localFonts.importProjectFonts(project, {
    onProgress: (nextProgress) => progress.push(nextProgress.stage),
  });
  const testFontWarning = (
    await localFonts.validateTestFontFiles(
      [new File(['ok'], 'Readable.ttf'), new File(['bad'], 'Broken.ttf')],
      { onProgress: (nextProgress) => progress.push(nextProgress.stage) },
    )
  ).warning;

  return {
    googleFontIds: Object.keys(googleResult.fonts).sort(),
    googleResolutionStatuses: googleResult.resolutions.map((resolution) => resolution.status),
    googleWarningCodes: googleResult.warnings.map((warning) => warning.code).sort(),
    localAddedFamilies: localResult.addedFonts.map((font) => `${font.family}:${font.fontWeight}`).sort(),
    localMissingWarnings: localResult.warnings.map((warning) => warning.code).sort(),
    localProgress: progress,
    missingFolderWarning: missingFolderResult.warnings[0]?.code,
    testFontWarning,
  };
}
