import PptxGenJS from 'pptxgenjs';
import type {
  Asset,
  DesignElement,
  Page,
  ProjectDocument,
  ShapeLineEndpoint,
  ShapeElement,
} from '../../domain/documents/model';
import type {
  PresentationExportOptions,
  PresentationExportProgress,
  PresentationExportResult,
  PresentationExportStats,
  PresentationExportWarning,
} from '../contracts/interfaces';
import { assetFileUtils } from '../storage/assetFileUtils';
import type { PptxPackagePatchPage } from './pptxPackagePatcher';
import { pptxPackagePatcher } from './pptxPackagePatcher';

const exportConstants = {
  customLayoutName: 'LOCALSTUDIO_CUSTOM',
  emuPerInch: 914400,
  pixelsPerInch: 144,
  pptxMimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

interface ExportContext {
  mediaIndex: number;
  progress?: ((progress: PresentationExportProgress) => void) | undefined;
  stats: PresentationExportStats;
  warnings: PresentationExportWarning[];
}

interface BrowserPptxExportServiceOptions {
  createPatchWorker?: () => Worker;
}

type PptxPatchWorkerResponse =
  | {
      buffer: ArrayBuffer;
      id: string;
      type: 'result';
      warnings: PresentationExportWarning[];
    }
  | {
      id: string;
      message: string;
      type: 'error';
    };

function normalizeHexColor(color: string | undefined, fallback = 'FFFFFF') {
  const normalized = color?.replace(/^#/, '').trim();
  return normalized && /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)
    ? normalized.length === 3
      ? normalized
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
          .toUpperCase()
      : normalized.toUpperCase()
    : fallback;
}

function getTransparency(opacity: number | undefined) {
  return Math.round((1 - Math.min(1, Math.max(0, opacity ?? 1))) * 100);
}

function getPageScale() {
  return {
    x: exportConstants.pixelsPerInch,
    y: exportConstants.pixelsPerInch,
  };
}

function toPosition(element: DesignElement): PptxGenJS.PositionProps {
  const scale = getPageScale();
  return {
    x: element.x / scale.x,
    y: element.y / scale.y,
    w: element.width / scale.x,
    h: element.height / scale.y,
  };
}

function emitProgress(context: ExportContext, progress: PresentationExportProgress) {
  context.progress?.(progress);
}

function describeMediaElement(element: Extract<DesignElement, { type: 'gif' | 'image' | 'video' }>) {
  if (element.type === 'gif') return 'animated GIF';
  if (element.type === 'video') return 'video';
  return 'image';
}

function blobToBase64Data(mimeType: string, bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `${mimeType};base64,${btoa(binary)}`;
}

async function assetToData(asset: Asset | undefined, warnings: PresentationExportWarning[], element: DesignElement, page: Page) {
  if (!asset?.objectUrl) {
    warnings.push({
      category: 'media',
      code: 'pptx-missing-asset-source',
      elementId: element.id,
      message: `Asset source was not readable for ${element.type} export.`,
      pageId: page.id,
    });
    return undefined;
  }
  const blob = await assetFileUtils.objectUrlToBlobIfReadable(asset.objectUrl, fetch).catch(() => undefined);
  if (!blob) {
    warnings.push({
      category: 'media',
      code: 'pptx-unreadable-asset',
      elementId: element.id,
      message: `Asset ${asset.name} could not be read for PowerPoint export.`,
      pageId: page.id,
    });
    return undefined;
  }
  return blobToBase64Data(asset.mimeType || blob.type || 'application/octet-stream', new Uint8Array(await blob.arrayBuffer()));
}

async function backgroundAssetToData(
  asset: Asset | undefined,
  warnings: PresentationExportWarning[],
  page: Page,
) {
  if (!asset?.objectUrl) {
    warnings.push({
      category: 'media',
      code: 'pptx-missing-background-asset-source',
      message: 'Background asset source was not readable for PowerPoint export.',
      pageId: page.id,
    });
    return undefined;
  }
  const blob = await assetFileUtils.objectUrlToBlobIfReadable(asset.objectUrl, fetch).catch(() => undefined);
  if (!blob) {
    warnings.push({
      category: 'media',
      code: 'pptx-unreadable-background-asset',
      message: `Background asset ${asset.name} could not be read for PowerPoint export.`,
      pageId: page.id,
    });
    return undefined;
  }
  return blobToBase64Data(
    asset.mimeType || blob.type || 'application/octet-stream',
    new Uint8Array(await blob.arrayBuffer()),
  );
}

function getShapeName(element: ShapeElement): PptxGenJS.SHAPE_NAME {
  const shapeMap: Partial<Record<ShapeElement['shape'], PptxGenJS.SHAPE_NAME>> = {
    arc: 'arc',
    arrow: 'rightArrow',
    diamond: 'diamond',
    ellipse: 'ellipse',
    line: 'line',
    parallelogram: 'parallelogram',
    pentagon: 'pentagon',
    rect: 'rect',
    'rounded-rect': 'roundRect',
    triangle: 'triangle',
  };
  return shapeMap[element.shape] ?? 'rect';
}

function addTextElement(slide: PptxGenJS.Slide, element: Extract<DesignElement, { type: 'text' }>) {
  slide.addText(element.text, {
    ...toPosition(element),
    align: element.align,
    bold: element.fontWeight >= 600,
    breakLine: false,
    color: normalizeHexColor(element.fill, '111111'),
    fit: 'shrink',
    fontFace: element.fontFamily,
    fontSize: element.fontSize,
    margin: 0,
    objectName: element.id,
    rotate: element.rotation,
    transparency: getTransparency(element.opacity),
    valign: element.verticalAlign ?? 'top',
  });
}

async function addImageElement(
  slide: PptxGenJS.Slide,
  project: ProjectDocument,
  element: Extract<DesignElement, { type: 'image' | 'gif' }>,
  page: Page,
  context: ExportContext,
) {
  const asset = project.assets[element.assetId];
  context.mediaIndex += 1;
  emitProgress(context, {
    current: context.mediaIndex,
    detail: `Reading ${asset?.name ?? describeMediaElement(element)}.`,
    label: `Embedding media ${context.mediaIndex} of ${context.stats.mediaElementCount}`,
    stage: 'embedding-media',
    total: context.stats.mediaElementCount,
  });
  const data = await assetToData(asset, context.warnings, element, page);
  if (!data) return;
  slide.addImage({
    ...toPosition(element),
    data,
    ...(element.type === 'image' && element.flipX ? { flipH: true } : {}),
    objectName: element.id,
    rotate: element.rotation,
    transparency: getTransparency(element.opacity),
  });
}

async function addVideoElement(
  slide: PptxGenJS.Slide,
  project: ProjectDocument,
  element: Extract<DesignElement, { type: 'video' }>,
  page: Page,
  context: ExportContext,
) {
  const asset = project.assets[element.assetId];
  context.mediaIndex += 1;
  emitProgress(context, {
    current: context.mediaIndex,
    detail: `Reading ${asset?.name ?? describeMediaElement(element)}.`,
    label: `Embedding media ${context.mediaIndex} of ${context.stats.mediaElementCount}`,
    stage: 'embedding-media',
    total: context.stats.mediaElementCount,
  });
  const data = await assetToData(asset, context.warnings, element, page);
  if (!data) return;
  slide.addMedia({
    ...toPosition(element),
    data,
    extn: assetFileUtils.getAssetFileExtension(asset?.mimeType ?? 'video/mp4'),
    objectName: element.id,
    type: 'video',
  });
  if (element.rotation !== 0) {
    context.warnings.push({
      category: 'fidelity',
      code: 'pptx-video-rotation-downgraded',
      elementId: element.id,
      message: 'PowerPoint media export does not preserve video rotation.',
      pageId: page.id,
    });
  }
  if (element.trimStartSeconds > 0 || element.trimEndSeconds !== undefined || element.repeatMode === 'loop-back-and-forth') {
    context.warnings.push({
      category: 'fidelity',
      code: 'pptx-video-playback-downgraded',
      elementId: element.id,
      message: 'PowerPoint export embeds the video but cannot preserve trim windows or back-and-forth repeat mode.',
      pageId: page.id,
    });
  }
  if (element.muted || element.volume !== undefined || element.posterFrameSeconds !== undefined) {
    context.warnings.push({
      category: 'fidelity',
      code: 'pptx-video-control-downgraded',
      elementId: element.id,
      message: 'PowerPoint export embeds the video but cannot preserve mute, volume, or poster frame controls.',
      pageId: page.id,
    });
  }
}

function mapLineEndpoint(endpoint: ShapeLineEndpoint | undefined) {
  if (!endpoint || endpoint === 'none') return 'none';
  if (endpoint === 'arrow' || endpoint === 'open-arrow') return 'arrow';
  if (endpoint === 'diamond') return 'diamond';
  if (endpoint === 'circle' || endpoint === 'open-circle') return 'oval';
  if (endpoint === 'bar' || endpoint === 'square' || endpoint === 'open-square') return 'triangle';
  return 'none';
}

function addShapeElement(slide: PptxGenJS.Slide, element: ShapeElement) {
  slide.addShape(getShapeName(element), {
    ...toPosition(element),
    fill: element.fill
      ? { color: normalizeHexColor(element.fill), transparency: getTransparency(element.opacity) }
      : { transparency: 100 },
    line: {
      beginArrowType: mapLineEndpoint(element.startEndpoint),
      color: normalizeHexColor(element.stroke, '111111'),
      endArrowType: mapLineEndpoint(element.endEndpoint),
      transparency: element.stroke ? getTransparency(element.opacity) : 100,
      width: element.strokeWidth ?? 0,
    },
    objectName: element.id,
    rotate: element.rotation,
  });
}

async function addPageBackground(
  slide: PptxGenJS.Slide,
  page: Page,
  project: ProjectDocument,
  context: ExportContext,
) {
  if (page.background.type === 'color') {
    slide.background = { color: normalizeHexColor(page.background.color) };
    return;
  }
  const asset = project.assets[page.background.assetId];
  const data = await backgroundAssetToData(asset, context.warnings, page);
  if (data) {
    slide.background = { data };
    return;
  }
  slide.background = { color: normalizeHexColor(page.background.colorFallback) };
}

function collectVisiblePages(project: ProjectDocument) {
  return project.pages.filter((page) => page.visible !== false);
}

function collectExportStats(project: ProjectDocument, pages: Page[]): PresentationExportStats {
  let animationBuildCount = 0;
  let mediaElementCount = 0;
  for (const page of pages) {
    const visibleElementIds = page.elementIds.filter((elementId) => {
      const element = project.elements[elementId];
      return Boolean(element && element.visible !== false);
    });
    const visibleElementIdSet = new Set(visibleElementIds);
    animationBuildCount += (page.animationBuilds ?? []).filter((build) =>
      visibleElementIdSet.has(build.elementId),
    ).length;
    mediaElementCount += visibleElementIds.filter((elementId) => {
      const element = project.elements[elementId];
      return element?.type === 'image' || element?.type === 'gif' || element?.type === 'video';
    }).length;
  }
  return {
    animationBuildCount,
    mediaElementCount,
    slideCount: pages.length,
  };
}

function defineProjectLayout(pptx: PptxGenJS, pages: Page[]) {
  const firstPage = pages[0] ?? { width: 1920, height: 1080 };
  pptx.defineLayout({
    name: exportConstants.customLayoutName,
    width: firstPage.width / exportConstants.pixelsPerInch,
    height: firstPage.height / exportConstants.pixelsPerInch,
  });
  pptx.layout = exportConstants.customLayoutName;
}

function createRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pptx-export-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createDefaultPptxPatchWorker() {
  if (typeof Worker === 'undefined') throw new Error('Web workers are not available.');
  return new Worker(new URL('./pptxPatch.worker.ts', import.meta.url), {
    type: 'module',
  });
}

function patchPackageInWorker(
  buffer: ArrayBuffer,
  pages: Page[],
  patchPages: PptxPackagePatchPage[],
  warnings: PresentationExportWarning[],
  createPatchWorker: () => Worker,
) {
  return new Promise<{ buffer: ArrayBuffer; warnings: PresentationExportWarning[] }>(
    (resolve, reject) => {
      const worker = createPatchWorker();
      const requestId = createRequestId();
      worker.onmessage = (event: MessageEvent<PptxPatchWorkerResponse>) => {
        const response = event.data;
        if (response.id !== requestId) return;
        worker.terminate();
        if (response.type === 'error') {
          reject(new Error(response.message));
          return;
        }
        resolve({ buffer: response.buffer, warnings: response.warnings });
      };
      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(event instanceof ErrorEvent ? event.message : 'PPTX patch worker failed.'));
      };
      worker.postMessage(
        {
          buffer,
          id: requestId,
          patchPages,
          pages,
          type: 'patch-pptx-package',
          warnings,
        },
        [buffer],
      );
    },
  );
}

async function patchPackage(
  blob: Blob,
  pages: Page[],
  patchPages: PptxPackagePatchPage[],
  context: ExportContext,
  createPatchWorker: (() => Worker) | undefined,
) {
  const buffer = await blob.arrayBuffer();
  if (createPatchWorker) {
    try {
      const result = await patchPackageInWorker(
        buffer,
        pages,
        patchPages,
        context.warnings,
        createPatchWorker,
      );
      context.warnings = result.warnings;
      return new Blob([result.buffer], { type: exportConstants.pptxMimeType });
    } catch (error) {
      if (buffer.byteLength === 0) throw error;
    }
  }
  const result = pptxPackagePatcher.patchPackageBuffer(buffer, pages, context.warnings, patchPages);
  context.warnings = result.warnings;
  return new Blob([result.buffer], { type: exportConstants.pptxMimeType });
}

function collectPackagePatchPages(project: ProjectDocument, pages: Page[]): PptxPackagePatchPage[] {
  return pages.map((page) => ({
    elements: page.elementIds
      .map((elementId) => project.elements[elementId])
      .filter((element): element is Extract<DesignElement, { type: 'image' }> =>
        Boolean(element && element.type === 'image' && element.crop),
      )
      .map((element) => ({
        crop: element.crop,
        id: element.id,
      })),
    pageId: page.id,
  }));
}

export class BrowserPptxExportService {
  private readonly createPatchWorker: (() => Worker) | undefined;

  constructor(options: BrowserPptxExportServiceOptions = {}) {
    this.createPatchWorker = options.createPatchWorker ?? createDefaultPptxPatchWorker;
  }

  async exportPowerPoint(
    project: ProjectDocument,
    options: PresentationExportOptions = {},
  ): Promise<PresentationExportResult> {
    const pages = collectVisiblePages(project);
    const patchPages = collectPackagePatchPages(project, pages);
    const stats = collectExportStats(project, pages);
    const context: ExportContext = {
      mediaIndex: 0,
      progress: options.onProgress,
      stats,
      warnings: [],
    };
    emitProgress(context, {
      current: 0,
      detail: `${stats.slideCount.toLocaleString()} slides, ${stats.mediaElementCount.toLocaleString()} media items, ${stats.animationBuildCount.toLocaleString()} animation builds.`,
      label: 'Preparing PowerPoint export',
      stage: 'preparing',
      total: stats.slideCount,
    });
    const pptx = new PptxGenJS();
    pptx.author = 'LocalStudio';
    pptx.company = 'LocalStudio';
    pptx.subject = project.name;
    pptx.title = project.name;
    defineProjectLayout(pptx, pages);

    for (const [pageIndex, page] of pages.entries()) {
      emitProgress(context, {
        current: pageIndex + 1,
        detail: page.name,
        label: `Building slide ${pageIndex + 1} of ${pages.length}`,
        stage: 'building-slides',
        total: pages.length,
      });
      const slide = pptx.addSlide();
      await addPageBackground(slide, page, project, context);
      if (page.speakerNotes?.trim()) slide.addNotes(page.speakerNotes);
      for (const elementId of page.elementIds) {
        const element = project.elements[elementId];
        if (!element || element.visible === false) continue;
        if (element.type === 'text') addTextElement(slide, element);
        else if (element.type === 'image' || element.type === 'gif') await addImageElement(slide, project, element, page, context);
        else if (element.type === 'video') await addVideoElement(slide, project, element, page, context);
        else if (element.type === 'shape') addShapeElement(slide, element);
      }
    }

    emitProgress(context, {
      detail: 'Writing editable slides and embedded assets.',
      label: 'Writing PowerPoint package',
      stage: 'writing-package',
    });
    const output = await pptx.write({ outputType: 'blob' });
    const baseBlob =
      output instanceof Blob
        ? output
        : new Blob([output instanceof Uint8Array ? new Uint8Array(output) : output], {
            type: exportConstants.pptxMimeType,
          });
    emitProgress(context, {
      detail: 'Authoring slide relationships, content types, and motion cues.',
      label: 'Authoring PowerPoint package',
      stage: 'patching-package',
    });
    const blob = await patchPackage(baseBlob, pages, patchPages, context, this.createPatchWorker);
    emitProgress(context, {
      detail: 'Checking media targets, content types, and timing targets.',
      label: 'Validating PowerPoint package',
      stage: 'validating-package',
    });
    emitProgress(context, {
      detail: 'Handing the finished file to the browser.',
      label: 'Starting download',
      stage: 'downloading',
    });
    return { blob, stats, warnings: context.warnings };
  }
}
