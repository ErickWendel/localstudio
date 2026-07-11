import { zipSync } from 'fflate';
import type { ElementAnimationBuild, ImageElement, ProjectDocument } from '../../../domain/documents/model';
import type { ImageExportOptions } from '../panels/ImageExportPanel';
import { canvasWorkspaceUtils } from '../canvas/canvasWorkspaceUtils';

export type ImageExportAnimationPreview = {
  activeBuildElementId: string | undefined;
  activeBuild?: ElementAnimationBuild | undefined;
  animationProgress?: number;
  hiddenElementIds: string[];
  mode?: 'editor' | 'presenter';
  pageId: string;
  phase: 'transition' | 'animation' | 'waiting' | 'complete';
  playing: boolean;
  waitingForClick: boolean;
};

export interface ImageExportFrame {
  animationPreview?: ImageExportAnimationPreview | undefined;
  fileName: string;
  pageId: string;
}

function waitForNextPaint() {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function bytesToBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function dataUrlToBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) throw new Error('Could not read exported slide image.');
  const metadata = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  if (!metadata.includes(';base64')) {
    return new TextEncoder().encode(decodeURIComponent(payload));
  }
  const binary = window.atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function appendFileNameSuffix(fileName: string, suffix: string) {
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0) return `${fileName}${suffix}`;
  return `${fileName.slice(0, extensionIndex)}${suffix}${fileName.slice(extensionIndex)}`;
}

function createAnimationPreview(
  pageId: string,
  hiddenElementIds: string[],
): ImageExportAnimationPreview {
  return {
    activeBuildElementId: undefined,
    animationProgress: 1,
    hiddenElementIds,
    mode: 'editor',
    pageId,
    phase: 'waiting',
    playing: false,
    waitingForClick: false,
  };
}

function getFrames({
  getPageImageFileName,
  options,
  project,
}: {
  getPageImageFileName: (
    project: ProjectDocument,
    pageId: string,
    extension: ImageExportOptions['format'],
  ) => string;
  options: ImageExportOptions;
  project: ProjectDocument;
}) {
  const extension = options.format;
  const pages =
    options.slideRange === 'all'
      ? project.pages
      : project.pages.slice(options.slideRange.from - 1, options.slideRange.to);

  return pages.flatMap((page) => {
    const pageFileName = getPageImageFileName(project, page.id, extension);
    const builds =
      page.animationBuilds?.filter((build) => {
        const element = project.elements[build.elementId];
        return element && element.visible !== false;
      }) ?? [];
    if (!options.includeAnimationFrames || builds.length === 0) {
      return [
        {
          animationPreview: createAnimationPreview(page.id, []),
          fileName: pageFileName,
          pageId: page.id,
        },
      ];
    }

    const buildInElementIds = builds
      .filter((build) => build.kind === undefined || build.kind === 'build-in')
      .map((build) => build.elementId);
    const hiddenElementIds = new Set(buildInElementIds);
    const frames: ImageExportFrame[] = [];

    builds.forEach((build, index) => {
      if (build.kind === 'build-out') {
        hiddenElementIds.add(build.elementId);
      } else if (build.kind === undefined || build.kind === 'build-in') {
        hiddenElementIds.delete(build.elementId);
      }
      frames.push({
        animationPreview: createAnimationPreview(page.id, Array.from(hiddenElementIds)),
        fileName: appendFileNameSuffix(
          pageFileName,
          `-animation-${String(index + 1).padStart(2, '0')}`,
        ),
        pageId: page.id,
      });
    });

    return frames;
  });
}

async function preloadFrameImages(project: ProjectDocument, pageId: string) {
  const page = project.pages.find((item) => item.id === pageId);
  const imageUrls =
    page?.elementIds
      .map((elementId) => project.elements[elementId])
      .filter(
        (element): element is ImageElement =>
          element?.type === 'image' && element.visible !== false,
      )
      .map((element) => project.assets[element.assetId]?.objectUrl)
      .filter((assetUrl): assetUrl is string => Boolean(assetUrl)) ?? [];
  await Promise.allSettled(
    imageUrls.map((assetUrl) => canvasWorkspaceUtils.preloadCanvasImage(assetUrl)),
  );
}

function createZipBlob(files: Record<string, Uint8Array>) {
  const archiveBytes = zipSync(files);
  return new Blob([bytesToBlobPart(archiveBytes)], { type: 'application/zip' });
}

export const editorImageExport = {
  createZipBlob,
  dataUrlToBytes,
  getFrames,
  preloadFrameImages,
  waitForNextPaint,
};
