import type { PptxDeck, PptxSlideObject } from '../../../apps/editor/src/services/importing/pptx/pptx-parser-model';
import type { PptxPackage } from '../../../apps/editor/src/services/importing/pptx/pptxPackage';

export type PptxProjectMapperContractResult = {
  assetIds: string[];
  cropSummary: Array<string | undefined>;
  fallbackLayoutElementIds: string[];
  layoutPlaceholderRoles: string[];
  missingAssetWarning: string | undefined;
  pageAnimationBuildCount: number;
  textFill: string | undefined;
};

export async function evaluatePptxProjectMapperContract(): Promise<PptxProjectMapperContractResult> {
  const { pptxProjectMapper } = (await import(
    '/editor/src/services/importing/pptx/pptxProjectMapper.ts'
  )) as typeof import('../../../apps/editor/src/services/importing/pptx/pptxProjectMapper');

  function createTextObject(
    id: string,
    text: string,
    overrides: Partial<Extract<PptxSlideObject, { kind: 'text' }>> = {},
  ): Extract<PptxSlideObject, { kind: 'text' }> {
    return {
      frame: { height: 420, width: 520, x: 20, y: 30 },
      id,
      kind: 'text',
      placeholderRole: 'title',
      rotation: 0,
      source: 'slide',
      sourceShapeId: id,
      style: {
        align: 'left',
        fill: '#111111',
        fontFamily: 'Aptos',
        fontSize: 144,
        fontWeight: 700,
        lineHeight: 1.1,
        verticalAlign: 'middle',
      },
      text,
      textBox: {
        autoFit: 'none',
        insets: { bottom: 8, left: 8, right: 8, top: 8 },
        verticalAlign: 'middle',
      },
      zIndex: 1,
      ...overrides,
    };
  }

  const files = [
    {
      blob: new Blob(['wide'], { type: 'image/png' }),
      imageSize: { height: 400, width: 1600 },
      path: 'ppt/media/wide.png',
    },
    {
      blob: new Blob(['tall'], { type: 'image/png' }),
      imageSize: { height: 1600, width: 400 },
      path: 'ppt/media/tall.png',
    },
    {
      blob: new Blob(['clip'], { type: 'video/mp4' }),
      path: 'ppt/media/clip.mp4',
    },
  ];
  const pptxPackage: PptxPackage = {
    files,
    getContentType: (path) =>
      path.endsWith('.mp4') ? 'video/mp4' : path.endsWith('.png') ? 'image/png' : undefined,
    getFile: (path) => files.find((file) => file.path === path),
    getRelationships: () => new Map(),
    readText: async () => {
      await Promise.resolve();
      return undefined;
    },
    warnings: [],
  };
  const layoutText = createTextObject('layout-title', 'Fallback layout title', {
    source: 'layout',
    textBox: {
      autoFit: 'shrink-text',
      insets: { bottom: 16, left: 16, right: 16, top: 16 },
      verticalAlign: 'bottom',
    },
  });
  const deck: PptxDeck = {
    height: 720,
    layouts: [],
    name: 'Mapper Contract',
    slides: [
      {
        animationBuilds: [
          {
            delayMs: 0,
            durationMs: 300,
            effect: 'fade',
            elementId: 'wide-image',
            id: 'build-wide',
            trigger: 'on-click',
          },
          {
            delayMs: 0,
            durationMs: 300,
            effect: 'fade',
            elementId: 'missing-image',
            id: 'build-missing',
            trigger: 'after-previous',
          },
        ],
        backgroundColor: '#111111',
        id: 'slide-1',
        layoutId: 'fallback-layout',
        layoutName: 'Fallback Layout',
        layoutObjects: [
          layoutText,
          {
            fill: '#00FF00',
            frame: { height: 80, width: 220, x: 100, y: 120 },
            id: 'layout-shape',
            kind: 'shape',
            shape: 'rect',
            source: 'layout',
            sourceShapeId: 'layout-shape',
            stroke: '#000000',
            strokeWidth: 2,
            zIndex: 2,
          },
          {
            assetPath: 'ppt/media/tall.png',
            frame: { height: 120, width: 240, x: 150, y: 210 },
            id: 'layout-image',
            kind: 'image',
            placeholderRole: 'body',
            source: 'layout',
            sourceShapeId: 'layout-image',
            zIndex: 3,
          },
        ],
        name: 'Mapped slide',
        objects: [
          createTextObject('slide-text', 'Unreadable on dark background', {
            placeholderRole: undefined,
            style: {
              align: 'left',
              fill: '#111111',
              fontFamily: 'Aptos',
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.2,
              verticalAlign: 'top',
            },
          }),
          {
            assetPath: 'ppt/media/wide.png',
            frame: { height: 100, width: 100, x: 10, y: 180 },
            id: 'wide-image',
            kind: 'image',
            source: 'slide',
            sourceShapeId: 'wide-image',
            zIndex: 2,
          },
          {
            assetPath: 'ppt/media/missing.png',
            frame: { height: 100, width: 100, x: 120, y: 180 },
            id: 'missing-image',
            kind: 'image',
            source: 'slide',
            sourceShapeId: 'missing-image',
            zIndex: 3,
          },
          {
            assetPath: 'ppt/media/clip.mp4',
            frame: { height: 120, width: 180, x: 240, y: 180 },
            id: 'video-1',
            kind: 'video',
            source: 'slide',
            sourceShapeId: 'video-1',
            startTrigger: 'on-click',
            zIndex: 4,
          },
        ],
        placeholderRoles: ['title', 'body'],
        speakerNotes: 'Mapper notes',
        transitionEffect: 'wipe',
        visible: true,
      },
    ],
    warnings: [],
    width: 1280,
  };

  const project = pptxProjectMapper.map(deck, pptxPackage);
  const layout = project.slideLayouts?.['fallback-layout'];
  const crops = ['wide-image', 'layout-image'].map((id) => {
    const element = { ...project.elements, ...(layout?.elements ?? {}) }[id];
    if (!element || !('crop' in element) || !element.crop) return undefined;
    return `${element.crop.x}:${element.crop.y}:${element.crop.width}:${element.crop.height}`;
  });

  return {
    assetIds: Object.keys(project.assets).sort(),
    cropSummary: crops,
    fallbackLayoutElementIds: layout?.elementIds ?? [],
    layoutPlaceholderRoles: layout?.placeholderRoles ?? [],
    missingAssetWarning: project.importWarnings?.find(
      (warning) => warning.code === 'pptx-missing-asset',
    )?.message,
    pageAnimationBuildCount: project.pages[0]?.animationBuilds?.length ?? 0,
    textFill:
      project.elements['slide-text']?.type === 'text'
        ? project.elements['slide-text'].fill
        : undefined,
  };
}
