import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import { BrowserPptxExportService } from '../../../src/services/exporting/pptxExportService';

const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const tinyGifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const tinyMp4DataUrl = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQ==';

async function readPptxEntries(blob: Blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

function readEntry(entries: Record<string, Uint8Array>, path: string) {
  const entry = entries[path];
  if (!entry) throw new Error(`Missing PPTX entry ${path}`);
  return strFromU8(entry);
}

function normalizeTargetPath(path: string) {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

function readRelationshipTargets(relsXml: string, sourcePath: string) {
  return Array.from(relsXml.matchAll(/\bTarget="([^"]+)"/g)).map((match) => {
    const target = match[1]!;
    if (target.startsWith('http')) return target;
    return normalizeTargetPath(`${sourcePath.split('/').slice(0, -1).join('/')}/${target}`);
  });
}

function createExportProject(): ProjectDocument {
  const now = '2026-07-04T00:00:00.000Z';
  return {
    id: 'project-export',
    name: 'Export Deck',
    createdAt: now,
    updatedAt: now,
    assets: {
      imageAsset: {
        id: 'imageAsset',
        type: 'image',
        name: 'hero.png',
        mimeType: 'image/png',
        objectUrl: tinyPngDataUrl,
        storage: 'inline',
      },
      gifAsset: {
        id: 'gifAsset',
        type: 'gif',
        name: 'motion.gif',
        mimeType: 'image/gif',
        objectUrl: tinyGifDataUrl,
        storage: 'inline',
      },
      videoAsset: {
        id: 'videoAsset',
        type: 'video',
        name: 'demo.mp4',
        mimeType: 'video/mp4',
        objectUrl: tinyMp4DataUrl,
        storage: 'inline',
      },
    },
    elements: {
      title: {
        id: 'title',
        type: 'text',
        text: 'Editable title',
        x: 120,
        y: 90,
        width: 640,
        height: 120,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        fontFamily: 'Arial',
        fontSize: 34,
        fontWeight: 700,
        fill: '#ffcc00',
        align: 'center',
        hyperlink: 'https://localstudio.dev',
      },
      image: {
        id: 'image',
        type: 'image',
        assetId: 'imageAsset',
        x: 820,
        y: 110,
        width: 360,
        height: 240,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.9,
        crop: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
        flipX: true,
      },
      gif: {
        id: 'gif',
        type: 'gif',
        assetId: 'gifAsset',
        x: 100,
        y: 300,
        width: 240,
        height: 160,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        playing: true,
      },
      video: {
        id: 'video',
        type: 'video',
        assetId: 'videoAsset',
        x: 420,
        y: 300,
        width: 360,
        height: 210,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 1,
        loop: false,
        controls: true,
        muted: false,
        autoplayInPreview: true,
        startOnClick: true,
        trimStartSeconds: 0,
      },
      box: {
        id: 'box',
        type: 'shape',
        shape: 'rounded-rect',
        x: 820,
        y: 410,
        width: 260,
        height: 120,
        rotation: 0,
        locked: false,
        visible: true,
        opacity: 0.8,
        fill: '#1166cc',
        stroke: '#ffffff',
        strokeWidth: 2,
        endEndpoint: 'arrow',
        startEndpoint: 'circle',
      },
      hidden: {
        id: 'hidden',
        type: 'text',
        text: 'Hidden',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        locked: false,
        visible: false,
        opacity: 1,
        fontFamily: 'Arial',
        fontSize: 12,
        fontWeight: 400,
        fill: '#000000',
        align: 'left',
      },
    },
    pages: [
      {
        id: 'slide-1',
        name: 'Slide 1',
        width: 1280,
        height: 720,
        background: { type: 'color', color: '#101010' },
        elementIds: ['title', 'image', 'gif', 'video', 'box', 'hidden'],
        speakerNotes: 'Speaker notes survive export.',
        transition: { effect: 'dissolve', delayMs: 250, durationMs: 500 },
        animationBuilds: [
          {
            id: 'build-title',
            elementId: 'title',
            effect: 'fade',
            trigger: 'after-transition',
            delayMs: 120,
            durationMs: 600,
            kind: 'build-in',
          },
          {
            id: 'build-image',
            elementId: 'image',
            effect: 'keyboard-typing',
            trigger: 'on-click',
            delayMs: 0,
            durationMs: 400,
            kind: 'emphasis',
          },
          {
            id: 'build-video',
            elementId: 'video',
            effect: 'reveal',
            trigger: 'on-click',
            delayMs: 0,
            durationMs: 0,
            kind: 'build-in',
            mediaAction: 'play',
          },
        ],
        visible: true,
      },
      {
        id: 'hidden-slide',
        name: 'Hidden Slide',
        width: 1280,
        height: 720,
        background: { type: 'color', color: '#ffffff' },
        elementIds: [],
        visible: false,
      },
    ],
  };
}

describe('BrowserPptxExportService', () => {
  it('exports core slides, media, transitions, animation XML, and warnings', async () => {
    const service = new BrowserPptxExportService();
    const progressLabels: string[] = [];
    const result = await service.exportPowerPoint(createExportProject(), {
      onProgress: (progress) => {
        progressLabels.push(progress.label);
      },
    });
    const entries = await readPptxEntries(result.blob);

    expect(entries['[Content_Types].xml']).toBeDefined();
    expect(entries['ppt/presentation.xml']).toBeDefined();
    expect(entries['ppt/slides/slide1.xml']).toBeDefined();
    expect(entries['ppt/slides/slide2.xml']).toBeUndefined();
    expect(Object.keys(entries).some((path) => path.startsWith('ppt/media/'))).toBe(true);
    expect(result.stats).toEqual({
      animationBuildCount: 3,
      mediaElementCount: 3,
      slideCount: 1,
    });
    expect(progressLabels).toEqual(
      expect.arrayContaining([
        'Preparing PowerPoint export',
        'Building slide 1 of 1',
        'Embedding media 1 of 3',
        'Embedding media 2 of 3',
        'Embedding media 3 of 3',
        'Writing PowerPoint package',
        'Authoring PowerPoint package',
        'Validating PowerPoint package',
        'Starting download',
      ]),
    );

    const contentTypesXml = readEntry(entries, '[Content_Types].xml');
    expect(contentTypesXml).toContain('Extension="gif" ContentType="image/gif"');
    expect(contentTypesXml).toContain('Extension="mp4" ContentType="video/mp4"');
    expect(contentTypesXml).toContain('Extension="mov" ContentType="video/quicktime"');
    expect(contentTypesXml).toContain('Extension="webm" ContentType="video/webm"');

    const slideRelsXml = readEntry(entries, 'ppt/slides/_rels/slide1.xml.rels');
    const relationshipTargets = readRelationshipTargets(slideRelsXml, 'ppt/slides/slide1.xml');
    expect(relationshipTargets).toContain('https://localstudio.dev');
    expect(relationshipTargets.some((target) => target.startsWith('ppt/media/'))).toBe(true);
    for (const target of relationshipTargets.filter((item) => item.startsWith('ppt/media/'))) {
      expect(entries[target]).toBeDefined();
    }

    const slideXml = readEntry(entries, 'ppt/slides/slide1.xml');
    expect(slideXml).toContain('Editable title');
    expect(slideXml).toContain(' u="sng"');
    expect(slideXml).not.toContain('Hidden');
    expect(slideXml).toContain('<p:transition dur="500" advClick="0" advTm="250"><p:fade/></p:transition>');
    expect(slideXml).toContain('<p:timing>');
    expect(slideXml).toContain('<a:srcRect l="10000" t="20000" r="20000" b="20000"/>');
    expect(slideXml).toContain('flipH="1"');
    expect(slideXml).toContain('<a:headEnd type="oval"/>');
    expect(slideXml).toContain('<a:tailEnd type="arrow"/>');
    expect(slideXml).toContain('presetClass="entr"');
    expect(slideXml).toContain('presetClass="emph"');
    expect(slideXml).toContain('presetClass="mediacall"');
    expect(slideXml).toContain('cmd="play"');
    expect(slideXml).toContain('nodeType="clickEffect"');
    expect(slideXml).toContain('nodeType="afterEffect"');

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'pptx-animation-effect-downgraded',
          category: 'animation',
          elementId: 'image',
          pageId: 'slide-1',
        }),
      ]),
    );
  });

  it('warns and omits unsupported transitions without blocking export', async () => {
    const project = createExportProject();
    project.pages[0] = {
      ...project.pages[0]!,
      transition: { effect: 'line-draw', delayMs: 0, durationMs: 500 },
    };
    const result = await new BrowserPptxExportService().exportPowerPoint(project);
    const entries = await readPptxEntries(result.blob);

    expect(readEntry(entries, 'ppt/slides/slide1.xml')).not.toContain('<p:transition>');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'pptx-transition-effect-downgraded',
          pageId: 'slide-1',
        }),
      ]),
    );
  });
});
