import { describe, expect, it, vi } from 'vitest';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import { BrowserLocalFontMirrorService } from '../../../src/services/fonts/localFontMirrorService';
import { localFontMirrorPreferences } from '../../../src/services/fonts/localFontMirrorPreferences';

function createFontFile(name: string) {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'font/woff2' });
}

function createFileHandle(file: File): FileSystemFileHandle {
  return {
    kind: 'file',
    name: file.name,
    getFile: () => Promise.resolve(file),
  } as unknown as FileSystemFileHandle;
}

function createDirectoryHandle(files: File[], name = 'Fonts'): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    queryPermission: () => Promise.resolve('granted'),
    requestPermission: () => Promise.resolve('granted'),
    async *entries() {
      for (const file of files) {
        await Promise.resolve();
        yield [file.name, createFileHandle(file)] as [string, FileSystemFileHandle];
      }
    },
  } as unknown as FileSystemDirectoryHandle;
}

function createProject(): ProjectDocument {
  return {
    id: 'font-project',
    name: 'Font project',
    assets: {},
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    pages: [
      {
        id: 'page-1',
        name: 'Slide 1',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
        elementIds: ['title'],
      },
    ],
    elements: {
      title: {
        id: 'title',
        type: 'text',
        x: 0,
        y: 0,
        width: 600,
        height: 120,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        text: 'Hello',
        fontFamily: 'Acme Sans',
        fontSize: 80,
        fontWeight: 700,
        fill: '#ffffff',
        align: 'left',
      },
    },
  };
}

describe('BrowserLocalFontMirrorService', () => {
  it('imports only matching used fonts from the selected local font folder', async () => {
    localFontMirrorPreferences.write({ enabled: true, folderLabel: 'Fonts' });
    const service = new BrowserLocalFontMirrorService({
      createObjectURL: vi.fn(() => 'blob:acme-sans'),
      fontDirectoryHandle: createDirectoryHandle([
        createFontFile('AcmeSans-Bold.woff2'),
        createFontFile('UnusedFont.woff2'),
      ]),
      now: () => new Date('2026-07-14T12:00:00.000Z'),
    });

    const result = await service.importProjectFonts(createProject());

    expect(result.unresolvedFamilies).toEqual([]);
    expect(result.addedFonts).toHaveLength(1);
    expect(result.addedFonts[0]).toMatchObject({
      id: 'font-acme-sans-700-acmesans-bold-woff2',
      family: 'Acme Sans',
      fileName: 'font-acme-sans-700-acmesans-bold-woff2.woff2',
      fontWeight: 700,
      mimeType: 'font/woff2',
      objectUrl: 'blob:acme-sans',
      source: 'uploaded',
      storage: 'inline',
    });
    expect(Object.keys(result.project.fonts ?? {})).toHaveLength(1);
    expect(result.project.updatedAt).toBe('2026-07-14T12:00:00.000Z');
  });

  it('lists available font families from the selected local font folder', async () => {
    localFontMirrorPreferences.write({ enabled: true, folderLabel: 'Fonts' });
    const service = new BrowserLocalFontMirrorService({
      fontDirectoryHandle: createDirectoryHandle([
        createFontFile('AcmeSans-Bold.woff2'),
        createFontFile('AcmeSans-Regular.woff2'),
        createFontFile('Orbitron.woff2'),
      ]),
    });

    await expect(service.listAvailableFonts()).resolves.toEqual([
      { family: 'Acme Sans', source: 'local-font-folder' },
      { family: 'Orbitron', source: 'local-font-folder' },
    ]);
  });

  it('imports a selected local font family even before it is used in the project', async () => {
    localFontMirrorPreferences.write({ enabled: true, folderLabel: 'Fonts' });
    const service = new BrowserLocalFontMirrorService({
      createObjectURL: vi.fn(() => 'blob:orbitron'),
      fontDirectoryHandle: createDirectoryHandle([createFontFile('Orbitron.woff2')]),
      now: () => new Date('2026-07-14T12:30:00.000Z'),
    });

    const result = await service.importFontFamily(createProject(), {
      family: 'Orbitron',
      fontStyle: 'normal',
      fontWeight: 400,
    });

    expect(result.unresolvedFamilies).toEqual([]);
    expect(result.addedFonts).toHaveLength(1);
    expect(result.addedFonts[0]).toMatchObject({
      family: 'Orbitron',
      fontWeight: 400,
      objectUrl: 'blob:orbitron',
      source: 'uploaded',
    });
    expect(result.project.updatedAt).toBe('2026-07-14T12:30:00.000Z');
  });

  it('skips families that are already embedded in the project', async () => {
    localFontMirrorPreferences.write({ enabled: true, folderLabel: 'Fonts' });
    const project = {
      ...createProject(),
      fonts: {
        acme: {
          id: 'acme',
          family: 'Acme Sans',
          requestedFamily: 'Acme Sans',
          source: 'uploaded' as const,
          fontStyle: 'normal' as const,
          fontWeight: 700,
          mimeType: 'font/woff2' as const,
          fileName: 'acme.woff2',
          storage: 'file' as const,
        },
      },
    };
    const service = new BrowserLocalFontMirrorService({
      fontDirectoryHandle: createDirectoryHandle([createFontFile('AcmeSans-Bold.woff2')]),
    });

    const result = await service.importProjectFonts(project);

    expect(result.addedFonts).toEqual([]);
    expect(result.unresolvedFamilies).toEqual([]);
    expect(result.project).toBe(project);
  });

  it('warns and allows sharing when a used font is not found locally', async () => {
    localFontMirrorPreferences.write({ enabled: true, folderLabel: 'Fonts' });
    const service = new BrowserLocalFontMirrorService({
      fontDirectoryHandle: createDirectoryHandle([createFontFile('DifferentFont.woff2')]),
    });

    const result = await service.importProjectFonts(createProject());

    expect(result.addedFonts).toEqual([]);
    expect(result.unresolvedFamilies).toEqual(['Acme Sans']);
    expect(result.warnings).toMatchObject([
      {
        code: 'local-font-not-found',
        severity: 'warning',
      },
    ]);
  });

  it('returns two readable font files for mirror connection checks', async () => {
    localFontMirrorPreferences.write({ enabled: true, folderLabel: 'Fonts' });
    const service = new BrowserLocalFontMirrorService({
      fontDirectoryHandle: createDirectoryHandle([
        createFontFile('One.woff2'),
        createFontFile('Two.woff2'),
        createFontFile('Three.woff2'),
      ]),
    });

    await expect(service.getTestFontFiles()).resolves.toHaveLength(2);
  });

});
