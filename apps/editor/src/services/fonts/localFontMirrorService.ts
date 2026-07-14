import type { ImportWarning, ProjectDocument, ProjectFont, TextElement } from '../../domain/documents/model';
import type {
  FontCatalogItem,
  FontImportRequest,
  LocalFontMirrorProgress,
  LocalFontMirrorResult,
  LocalFontMirrorService,
  LocalFontMirrorSettings,
  LocalFontMirrorTestResult,
} from '../contracts/interfaces';
import { localFontFolderHandleStore } from './localFontFolderHandleStore';
import { localFontMirrorPreferences } from './localFontMirrorPreferences';

interface BrowserLocalFontMirrorServiceOptions {
  createObjectURL?: typeof URL.createObjectURL;
  fontDirectoryHandle?: FileSystemDirectoryHandle | undefined;
  fontFaceConstructor?: typeof FontFace | undefined;
  now?: () => Date;
  showDirectoryPicker?: (() => Promise<FileSystemDirectoryHandle>) | undefined;
}

type PermissionMode = 'read' | 'readwrite';

type DirectoryHandleWithPermissions = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: PermissionMode }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: PermissionMode }) => Promise<PermissionState>;
};

const FONT_EXTENSIONS = ['woff2', 'woff', 'ttf', 'otf'] as const;
const FONT_MIME_TYPES: Record<(typeof FONT_EXTENSIONS)[number], ProjectFont['mimeType']> = {
  otf: 'font/otf',
  ttf: 'font/ttf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};
const MAX_SCAN_DEPTH = 3;
const MAX_TEST_FONT_FILES = 2;

function getDefaultShowDirectoryPicker() {
  if (typeof window === 'undefined') return undefined;
  const runtimeWindow = window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> };
  return runtimeWindow.showDirectoryPicker?.bind(runtimeWindow);
}

function getSystemHint() {
  const runtimeNavigator =
    typeof navigator === 'undefined'
      ? undefined
      : (navigator as Navigator & { userAgentData?: { platform?: string } });
  const platform =
    !runtimeNavigator
      ? ''
      : `${runtimeNavigator.userAgentData?.platform ?? runtimeNavigator.platform ?? ''}`.toLowerCase();
  if (platform.includes('mac')) return '~/Library/Fonts or /Library/Fonts';
  if (platform.includes('win')) {
    return 'C:\\Windows\\Fonts or %LOCALAPPDATA%\\Microsoft\\Windows\\Fonts';
  }
  return '~/.local/share/fonts, /usr/share/fonts, or ~/.fonts';
}

function normalizeFamily(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function getFirstFontFamily(fontFamily: string) {
  return fontFamily
    .split(',')
    .map((family) => family.trim().replace(/^["']|["']$/g, ''))
    .find(Boolean);
}

function collectTextFontFamilies(project: ProjectDocument) {
  const families = new Map<string, string>();
  const addFamily = (fontFamily: string | undefined) => {
    const family = fontFamily ? getFirstFontFamily(fontFamily) : undefined;
    if (!family) return;
    families.set(normalizeFamily(family), family);
  };

  for (const element of Object.values(project.elements)) {
    if (element.type === 'text') addFamily(element.fontFamily);
  }
  for (const theme of Object.values(project.themes ?? {})) {
    addFamily(theme.typography.bodyFontFamily);
    addFamily(theme.typography.headingFontFamily);
  }
  for (const layout of Object.values(project.slideLayouts ?? {})) {
    for (const element of Object.values(layout.elements)) {
      if (element.type === 'text') addFamily(element.fontFamily);
    }
  }

  return Array.from(families.values()).sort((left, right) => left.localeCompare(right));
}

function collectFontWeights(project: ProjectDocument, family: string) {
  const normalizedFamily = normalizeFamily(family);
  const weights = new Set<number>();
  const addWeight = (element: TextElement) => {
    if (normalizeFamily(getFirstFontFamily(element.fontFamily) ?? '') !== normalizedFamily) return;
    weights.add(element.fontWeight >= 700 ? 700 : 400);
  };
  for (const element of Object.values(project.elements)) {
    if (element.type === 'text') addWeight(element);
  }
  for (const layout of Object.values(project.slideLayouts ?? {})) {
    for (const element of Object.values(layout.elements)) {
      if (element.type === 'text') addWeight(element);
    }
  }
  return weights.size > 0 ? Array.from(weights).sort((left, right) => left - right) : [400];
}

function getEmbeddedFontFamilies(project: ProjectDocument) {
  return new Set(Object.values(project.fonts ?? {}).map((font) => normalizeFamily(font.family)));
}

function getFontExtension(fileName: string) {
  const extension = fileName.split('.').at(-1)?.toLowerCase();
  return FONT_EXTENSIONS.find((item) => item === extension);
}

function fontFileMatchesFamily(file: File, family: string) {
  const stem = file.name.replace(/\.[^.]+$/g, '');
  return normalizeFamily(stem).includes(normalizeFamily(family));
}

function inferFamilyFromFileName(fileName: string) {
  const stem = fileName
    .replace(/\.[^.]+$/g, '')
    .replace(
      /\b(black|bold|book|condensed|display|extra|extrabold|hairline|heavy|italic|light|medium|regular|semibold|thin|variable|vf)\b/gi,
      ' ',
    )
    .replace(/[-_.]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return stem || fileName.replace(/\.[^.]+$/g, '');
}

function createFontId(family: string, fontWeight: number, fileName: string) {
  const familySlug = family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const fileSlug = fileName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `font-${familySlug || 'font'}-${fontWeight}-${fileSlug || 'file'}`;
}

async function scanFontFiles(directory: FileSystemDirectoryHandle, depth = 0): Promise<File[]> {
  const entries = (directory as unknown as {
    entries?: () => AsyncIterable<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
  }).entries;
  if (!entries) return [];

  const files: File[] = [];
  for await (const [, handle] of entries.call(directory)) {
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      if (getFontExtension(file.name)) files.push(file);
      continue;
    }
    if (handle.kind === 'directory' && depth < MAX_SCAN_DEPTH) {
      files.push(...(await scanFontFiles(handle, depth + 1)));
    }
  }
  return files.sort((left, right) => left.name.localeCompare(right.name));
}

async function ensureReadPermission(directory: FileSystemDirectoryHandle) {
  const handle = directory as DirectoryHandleWithPermissions;
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const currentPermission = await handle.queryPermission({ mode: 'read' });
  if (currentPermission === 'granted') return true;
  return (await handle.requestPermission({ mode: 'read' })) === 'granted';
}

export class BrowserLocalFontMirrorService implements LocalFontMirrorService {
  private readonly createObjectURL: typeof URL.createObjectURL;
  private fontDirectoryHandle: FileSystemDirectoryHandle | undefined;
  private readonly fontFaceConstructor: typeof FontFace | undefined;
  private readonly now: () => Date;
  private readonly showDirectoryPicker: (() => Promise<FileSystemDirectoryHandle>) | undefined;

  constructor(options: BrowserLocalFontMirrorServiceOptions = {}) {
    this.createObjectURL = options.createObjectURL ?? URL.createObjectURL.bind(URL);
    this.fontDirectoryHandle = options.fontDirectoryHandle;
    this.fontFaceConstructor = options.fontFaceConstructor ?? (typeof FontFace !== 'undefined' ? FontFace : undefined);
    this.now = options.now ?? (() => new Date());
    this.showDirectoryPicker = options.showDirectoryPicker ?? getDefaultShowDirectoryPicker();
  }

  getSettings(): LocalFontMirrorSettings {
    const preference = localFontMirrorPreferences.read();
    return {
      ...preference,
      supported: Boolean(this.showDirectoryPicker),
      systemHint: getSystemHint(),
    };
  }

  setEnabled(enabled: boolean): LocalFontMirrorSettings {
    const current = localFontMirrorPreferences.read();
    localFontMirrorPreferences.write({ ...current, enabled });
    return this.getSettings();
  }

  async chooseFontFolder(): Promise<LocalFontMirrorSettings> {
    if (!this.showDirectoryPicker) throw new Error('This browser cannot choose a font folder.');
    const handle = await this.showDirectoryPicker();
    this.fontDirectoryHandle = handle;
    await localFontFolderHandleStore.save(handle);
    localFontMirrorPreferences.write({ enabled: true, folderLabel: handle.name });
    return this.getSettings();
  }

  async listAvailableFonts(): Promise<FontCatalogItem[]> {
    if (!this.getSettings().enabled) return [];
    const files = await this.loadAvailableFontFiles();
    const fonts = new Map<string, FontCatalogItem>();
    for (const file of files) {
      const family = inferFamilyFromFileName(file.name);
      const key = normalizeFamily(family);
      if (!key || fonts.has(key)) continue;
      fonts.set(key, { family, source: 'local-font-folder' });
    }
    return Array.from(fonts.values()).sort((left, right) =>
      left.family.localeCompare(right.family),
    );
  }

  async importFontFamily(
    project: ProjectDocument,
    request: FontImportRequest,
    options: { onProgress?: (progress: LocalFontMirrorProgress) => void } = {},
  ): Promise<LocalFontMirrorResult> {
    const settings = this.getSettings();
    const warnings: ImportWarning[] = [];
    if (!settings.enabled) {
      return {
        project,
        addedFonts: [],
        unresolvedFamilies: [request.family],
        warnings: [
          this.createWarning(
            'local-font-mirroring-disabled',
            'Local font mirroring is not enabled.',
          ),
        ],
      };
    }

    options.onProgress?.({ label: 'Scanning font folder', stage: 'scanning-font-folder' });
    const files = await this.loadAvailableFontFiles();
    const matchingFile = files.find((file) => fontFileMatchesFamily(file, request.family));
    const extension = matchingFile ? getFontExtension(matchingFile.name) : undefined;
    if (!matchingFile || !extension) {
      return {
        project,
        addedFonts: [],
        unresolvedFamilies: [request.family],
        warnings: [
          this.createWarning(
            'local-font-not-found',
            `${request.family} was not found in the selected font folder.`,
          ),
        ],
      };
    }

    options.onProgress?.({ label: 'Adding project fonts', stage: 'adding-project-fonts' });
    const fontWeight = request.fontWeight >= 700 ? 700 : 400;
    const id = createFontId(request.family, fontWeight, matchingFile.name);
    const font: ProjectFont = {
      id,
      family: request.family,
      requestedFamily: request.family,
      source: 'uploaded',
      fontStyle: request.fontStyle,
      fontWeight,
      mimeType: FONT_MIME_TYPES[extension],
      fileName: `${id}.${extension}`,
      storage: 'inline',
      objectUrl: this.createObjectURL(matchingFile),
      sourceUrl: `local-font-folder://${matchingFile.name}`,
    };

    return {
      project: {
        ...project,
        fonts: { ...(project.fonts ?? {}), [id]: font },
        updatedAt: this.now().toISOString(),
      },
      addedFonts: [font],
      unresolvedFamilies: [],
      warnings,
    };
  }

  async importProjectFonts(
    project: ProjectDocument,
    options: { onProgress?: (progress: LocalFontMirrorProgress) => void } = {},
  ): Promise<LocalFontMirrorResult> {
    const settings = this.getSettings();
    const warnings: ImportWarning[] = [];
    if (!settings.enabled) return { project, addedFonts: [], unresolvedFamilies: [], warnings };

    const usedFamilies = collectTextFontFamilies(project);
    const embeddedFamilies = getEmbeddedFontFamilies(project);
    const unresolvedFamilies = usedFamilies.filter((family) => !embeddedFamilies.has(normalizeFamily(family)));
    if (unresolvedFamilies.length === 0) return { project, addedFonts: [], unresolvedFamilies: [], warnings };

    options.onProgress?.({ label: 'Checking local fonts', stage: 'checking-local-fonts' });
    const files = await this.loadAvailableFontFiles();
    if (files.length === 0) {
      return {
        project,
        addedFonts: [],
        unresolvedFamilies,
        warnings: [this.createWarning('local-font-folder-missing', 'Local font mirroring is enabled, but the font folder is not available.')],
      };
    }

    options.onProgress?.({ label: 'Scanning font folder', stage: 'scanning-font-folder' });
    const addedFonts: ProjectFont[] = [];
    const nextFonts = { ...(project.fonts ?? {}) };
    const stillUnresolved: string[] = [];

    options.onProgress?.({ label: 'Adding project fonts', stage: 'adding-project-fonts' });
    for (const family of unresolvedFamilies) {
      const matchingFile = files.find((file) => fontFileMatchesFamily(file, family));
      const extension = matchingFile ? getFontExtension(matchingFile.name) : undefined;
      if (!matchingFile || !extension) {
        stillUnresolved.push(family);
        continue;
      }
      for (const fontWeight of collectFontWeights(project, family)) {
        const id = createFontId(family, fontWeight, matchingFile.name);
        const font: ProjectFont = {
          id,
          family,
          requestedFamily: family,
          source: 'uploaded',
          fontStyle: 'normal',
          fontWeight,
          mimeType: FONT_MIME_TYPES[extension],
          fileName: `${id}.${extension}`,
          storage: 'inline',
          objectUrl: this.createObjectURL(matchingFile),
          sourceUrl: `local-font-folder://${matchingFile.name}`,
        };
        nextFonts[id] = font;
        addedFonts.push(font);
      }
    }

    for (const family of stillUnresolved) {
      warnings.push(this.createWarning('local-font-not-found', `${family} was not found in the selected font folder.`));
    }

    return {
      project: addedFonts.length > 0 ? { ...project, fonts: nextFonts, updatedAt: this.now().toISOString() } : project,
      addedFonts,
      unresolvedFamilies: stillUnresolved,
      warnings,
    };
  }

  async getTestFontFiles(
    options: { onProgress?: (progress: LocalFontMirrorProgress) => void } = {},
  ): Promise<File[]> {
    if (!this.getSettings().enabled) return [];
    options.onProgress?.({ label: 'Scanning font folder', stage: 'scanning-font-folder' });
    const directory = await this.loadReadableFontDirectory();
    if (!directory) return [];
    return (await scanFontFiles(directory)).slice(0, MAX_TEST_FONT_FILES);
  }

  async validateTestFontFiles(
    files: File[],
    options: { onProgress?: (progress: LocalFontMirrorProgress) => void } = {},
  ): Promise<LocalFontMirrorTestResult> {
    if (files.length === 0) {
      return { warning: 'Storage is ready, but no readable font files were found in the selected folder.' };
    }
    if (!this.fontFaceConstructor) return {};

    options.onProgress?.({ label: 'Verifying mirrored fonts', stage: 'verifying-mirrored-fonts' });
    const failures: string[] = [];
    for (const file of files) {
      const objectUrl = this.createObjectURL(file);
      try {
        const fontFace = new this.fontFaceConstructor(`LocalStudio Test ${file.name}`, `url(${objectUrl})`);
        await fontFace.load();
      } catch {
        failures.push(file.name);
      }
    }
    if (failures.length === files.length) {
      return {
        warning:
          'Storage is ready, but the selected folder does not look like a usable system fonts folder.',
      };
    }
    if (failures.length > 0) {
      return {
        warning: `Storage is ready, but ${failures.join(', ')} could not be loaded as a font.`,
      };
    }
    return {};
  }

  private async loadAvailableFontFiles() {
    const directory = await this.loadReadableFontDirectory();
    return directory ? scanFontFiles(directory) : [];
  }

  private async loadReadableFontDirectory() {
    const directory = this.fontDirectoryHandle ?? (await localFontFolderHandleStore.load());
    if (!directory) return undefined;
    if (!(await ensureReadPermission(directory))) return undefined;
    return directory;
  }

  private createWarning(code: string, message: string): ImportWarning {
    return { code, message, severity: 'warning' };
  }
}
