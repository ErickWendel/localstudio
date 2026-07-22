import type {
  ImageElement,
  ProjectDocument,
  ShapeElement,
} from '../../../apps/editor/src/domain/documents/model';

export async function evaluateEditorHelperCoverageContract() {
  const { imageCrop } = (await import(
    '/editor/src/ui/editor/canvas/imageCrop.ts'
  )) as typeof import('../../../apps/editor/src/ui/editor/canvas/imageCrop');
  const { pptxVisualStyle } = (await import(
    '/editor/src/services/importing/pptx/pptx-visual-style.ts'
  )) as typeof import('../../../apps/editor/src/services/importing/pptx/pptx-visual-style');
  const { powerPointIo } = (await import(
    '/editor/src/ui/editor/state/power-point-io.ts'
  )) as typeof import('../../../apps/editor/src/ui/editor/state/power-point-io');
  const { canvasWorkspaceUtils } = (await import(
    '/editor/src/ui/editor/canvas/canvasWorkspaceUtils.ts'
  )) as typeof import('../../../apps/editor/src/ui/editor/canvas/canvasWorkspaceUtils');
  const { applyGeneratedSlideCommand } = (await import(
    '/editor/src/domain/commands/generated-slides/applyGeneratedSlideCommand.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/generated-slides/applyGeneratedSlideCommand');
  const parseXml = (xml: string) =>
    new DOMParser().parseFromString(xml, 'application/xml').documentElement;
  const createShapeElement = (shape: ShapeElement['shape']): ShapeElement => ({
    fill: '#445566',
    height: 80,
    id: `shape-${shape}`,
    locked: false,
    opacity: 1,
    rotation: 0,
    shape,
    stroke: '#112233',
    strokeWidth: 2,
    type: 'shape',
    visible: true,
    width: 120,
    x: 0,
    y: 0,
  });
  const applyGeneratedSlideCommands = () => {
    const project: ProjectDocument = {
      assets: {},
      createdAt: '2026-07-22T00:00:00.000Z',
      elements: {
        old: {
          fill: '#000000',
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: 700,
          height: 80,
          id: 'old',
          locked: false,
          opacity: 1,
          rotation: 0,
          text: 'Old element',
          type: 'text',
          visible: true,
          width: 300,
          x: 20,
          y: 20,
        },
      },
      id: 'generated-helper-project',
      name: 'Generated helper project',
      pages: [
        {
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['old'],
          height: 1080,
          id: 'page-1',
          name: 'Before',
          visible: true,
          width: 1920,
        },
      ],
      updatedAt: '2026-07-22T00:00:00.000Z',
    };
    const preparedProject = new applyGeneratedSlideCommand.PrepareGeneratedSlideCommand('page-1', {
      background: { color: '#111111', type: 'color' },
      height: 1080,
      name: 'Generated helper slide',
      width: 1920,
    }).execute(project);
    const withRemoteImage = new applyGeneratedSlideCommand.AddGeneratedSlideElementCommand('page-1', {
      assetRole: 'remote',
      height: 300,
      id: 'remote Hero',
      opacity: 0.9,
      rotation: 0,
      src: 'https://example.test/generated-image.png',
      type: 'image',
      width: 400,
      x: 100,
      y: 120,
    }).execute(preparedProject);
    return new applyGeneratedSlideCommand.AddGeneratedSlideElementCommand('page-1', {
      fill: '#AA5500',
      height: 140,
      id: 'shape/stroked',
      opacity: 1,
      rotation: 12,
      shape: 'triangle',
      stroke: '#002244',
      strokeWidth: 6,
      type: 'shape',
      width: 160,
      x: 40,
      y: 60,
    }).execute(withRemoteImage);
  };

  const imageElement: ImageElement = {
    assetId: 'asset-image',
    crop: { height: 0.5, width: 0.5, x: 0.25, y: 0.25 },
    height: 240,
    id: 'image-1',
    locked: false,
    opacity: 1,
    rotation: 0,
    type: 'image',
    visible: true,
    width: 320,
    x: 40,
    y: 60,
  };
  const cropPatches = [
    imageCrop.calculateImageCropPatch(imageElement, 'left', { x: 80, y: 0 }),
    imageCrop.calculateImageCropPatch(imageElement, 'top', { x: 0, y: 80 }),
    imageCrop.calculateImageCropPatch(imageElement, 'top-left', { x: -200, y: -200 }),
    imageCrop.calculateImageCropPatch(imageElement, 'bottom-right', { x: 200, y: 200 }),
  ];
  const normalizedCrop = imageCrop.getImageCrop({
    ...imageElement,
    crop: { height: 2, width: 2, x: -1, y: -1 },
  });

  const theme = {
    colors: new Map([
      ['accent1', '336699'],
      ['dk1', '101010'],
      ['lt1', 'F0F0F0'],
    ]),
  };
  const themedColor = pptxVisualStyle.getHexColor(
    parseXml('<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:schemeClr val="bg1"><a:tint val="50000"/><a:lumMod val="80000"/><a:lumOff val="10000"/></a:schemeClr></a:solidFill>'),
    '#000000',
    theme,
  );
  const shadedColor = pptxVisualStyle.getHexColor(
    parseXml('<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:srgbClr val="6699CC"><a:shade val="50000"/></a:srgbClr></a:solidFill>'),
    '#000000',
  );
  const systemColor = pptxVisualStyle.getHexColor(
    parseXml('<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:sysClr lastClr="ABCDEF"><a:alpha val="35000"/></a:sysClr></a:solidFill>'),
    '#000000',
  );
  const blipOpacity = pptxVisualStyle.getOpacity(
    parseXml('<a:blipFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:blip><a:alphaModFix amt="42000"/></a:blip></a:blipFill>'),
  );
  const solidOpacity = pptxVisualStyle.getOpacity(
    parseXml('<a:spPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:solidFill><a:alpha val="25000"/></a:solidFill></a:spPr>'),
  );
  const exportSummary = powerPointIo.summarizeExport({
    blob: new Blob(['pptx']),
    stats: {
      animationBuildCount: 2,
      mediaElementCount: 3,
      slideCount: 1,
    },
    warnings: [
      { code: 'animation-not-supported', message: 'Animation fallback.' },
      { category: 'transition', code: 'fade-transition', message: 'Transition fallback.' },
      { code: 'video-export-fallback', message: 'Video fallback.' },
      { code: 'unknown-export-warning', message: 'Other fallback.' },
    ],
  });
  const exportProgress = powerPointIo.formatExportProgress({
    current: 12,
    detail: 'Writing slides',
    label: 'Exporting diagnostics',
    total: 10,
  });
  const emptyProgress = powerPointIo.formatExportProgress({
    label: 'Exporting without totals',
    total: 0,
  });
  const shapeLabels = [
    canvasWorkspaceUtils.getElementLabel({
      ...createShapeElement('parallelogram'),
      id: 'shape-parallelogram',
    }),
    canvasWorkspaceUtils.getElementLabel({
      ...createShapeElement('rounded-rect'),
      id: 'shape-rounded',
    }),
  ];
  const polygonPoints = [
    canvasWorkspaceUtils.getPolygonPoints('parallelogram', 100, 50),
    canvasWorkspaceUtils.getPolygonPoints('pentagon', 100, 100).map((value) =>
      Number(value.toFixed(2)),
    ),
  ];
  const generatedProject = applyGeneratedSlideCommands();

  return {
    cropFrames: cropPatches.map((patch) => patch.frame),
    cropRects: cropPatches.map((patch) => patch.crop),
    exportProgress,
    exportSummary,
    emptyProgress,
    generatedAssetIds: Object.keys(generatedProject.assets).sort(),
    generatedElementIds: generatedProject.pages[0]?.elementIds,
    generatedPageName: generatedProject.pages[0]?.name,
    normalizedCrop,
    opacities: [blipOpacity, solidOpacity],
    polygonPoints,
    shapeLabels,
    visualColors: [themedColor, shadedColor, systemColor],
  };
}
