import type { ImportWarning } from '../../../domain/documents/model';
import type { PptxPackageFile } from './pptxPackageTypes';
import { pptxFileUtils } from './pptxFileUtils';
import { pptxImageDimensions } from './pptxImageDimensions';
import { pptxTiffRaster } from './pptxTiffRaster';
import { pptxXml } from './pptxXml';

export interface PptxRelationship {
  id: string;
  target: string;
  targetMode: 'External' | 'Internal';
  type: string;
}

export interface PptxPackage {
  files: PptxPackageFile[];
  getContentType(path: string): string | undefined;
  getFile(path: string): PptxPackageFile | undefined;
  getRelationships(sourcePath: string): Map<string, PptxRelationship>;
  readText(path: string | undefined): Promise<string | undefined>;
  warnings: ImportWarning[];
}

const CONTENT_TYPES_PATH = '[Content_Types].xml';
const PACKAGE_RELS_PATH = '_rels/.rels';

function relsPathFor(sourcePath: string) {
  if (!sourcePath) return PACKAGE_RELS_PATH;
  const parts = sourcePath.split('/');
  const fileName = parts.pop() ?? '';
  return `${parts.join('/')}/_rels/${fileName}.rels`;
}

async function readText(file: PptxPackageFile | undefined) {
  if (!file) return undefined;
  return file.blob.text();
}

function extensionFor(path: string) {
  const fileName = path.split('/').at(-1) ?? path;
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
}

function getContentTypeForPath(
  path: string,
  defaults: Map<string, string>,
  overrides: Map<string, string>,
) {
  return (
    overrides.get(pptxFileUtils.normalizePath(path)) ??
    defaults.get(extensionFor(path)) ??
    pptxFileUtils.getMimeType(path)
  );
}

function parseContentTypes(xml: string | undefined) {
  const defaults = new Map<string, string>();
  const overrides = new Map<string, string>();
  if (!xml) return { defaults, overrides };
  const document = pptxXml.parseXml(xml);
  for (const element of pptxXml.descendants(document, 'Default')) {
    const extension = element.getAttribute('Extension')?.toLowerCase();
    const contentType = element.getAttribute('ContentType');
    if (extension && contentType) defaults.set(extension, contentType);
  }
  for (const element of pptxXml.descendants(document, 'Override')) {
    const partName = element.getAttribute('PartName');
    const contentType = element.getAttribute('ContentType');
    if (partName && contentType) {
      overrides.set(pptxFileUtils.normalizePath(partName), contentType);
    }
  }
  return { defaults, overrides };
}

function parseRelationships(xml: string | undefined, sourcePath: string) {
  const relationships = new Map<string, PptxRelationship>();
  if (!xml) return relationships;
  const document = pptxXml.parseXml(xml);
  for (const element of pptxXml.descendants(document, 'Relationship')) {
    const id = element.getAttribute('Id');
    const type = element.getAttribute('Type');
    const target = element.getAttribute('Target');
    if (!id || !type || !target) continue;
    const targetMode = element.getAttribute('TargetMode') === 'External' ? 'External' : 'Internal';
    relationships.set(id, {
      id,
      type,
      target: targetMode === 'External' ? target : pptxFileUtils.resolveRelativePath(sourcePath, target),
      targetMode,
    });
  }
  return relationships;
}

async function rasterizeBrowserImage(file: PptxPackageFile, mimeType: string | undefined) {
  const lowerPath = file.path.toLowerCase();
  if (mimeType !== 'image/tiff' && mimeType !== 'image/tif' && !lowerPath.endsWith('.tif') && !lowerPath.endsWith('.tiff')) {
    return file;
  }
  const png = pptxTiffRaster.toPng(new Uint8Array(await file.blob.arrayBuffer()));
  if (!png) return file;
  return {
    ...file,
    blob: new Blob([png], { type: 'image/png' }),
  };
}

async function create(files: PptxPackageFile[]): Promise<PptxPackage> {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const { defaults, overrides } = parseContentTypes(await readText(filesByPath.get(CONTENT_TYPES_PATH)));
  const warnings: ImportWarning[] = [];
  const convertedMimeTypes = new Map<string, string>();
  const displayFiles = await Promise.all(
    files.map(async (file) => {
      const sourceMimeType = getContentTypeForPath(file.path, defaults, overrides);
      const rasterized = await rasterizeBrowserImage(file, sourceMimeType);
      if (rasterized.blob !== file.blob) {
        convertedMimeTypes.set(file.path, 'image/png');
        return rasterized;
      }
      if (
        sourceMimeType === 'image/tiff' ||
        sourceMimeType === 'image/tif' ||
        file.path.toLowerCase().endsWith('.tif') ||
        file.path.toLowerCase().endsWith('.tiff')
      ) {
        warnings.push({
          code: 'pptx-unsupported-tiff',
          message: `PowerPoint TIFF ${file.path} could not be converted for browser display.`,
          severity: 'warning',
        });
      }
      return file;
    }),
  );
  const enrichedFiles = await Promise.all(
    displayFiles.map(async (file) => {
      const imageSize = await pptxImageDimensions.getSize(
        file,
        convertedMimeTypes.get(file.path) ?? getContentTypeForPath(file.path, defaults, overrides),
      );
      return imageSize ? { ...file, imageSize } : file;
    }),
  );
  const enrichedFilesByPath = new Map(enrichedFiles.map((file) => [file.path, file]));
  const relationshipCache = new Map<string, Map<string, PptxRelationship>>();

  const getContentType = (path: string) =>
    convertedMimeTypes.get(pptxFileUtils.normalizePath(path)) ??
    getContentTypeForPath(path, defaults, overrides);

  const getRelationships = (sourcePath: string) => {
    const normalizedSource = pptxFileUtils.normalizePath(sourcePath);
    const cached = relationshipCache.get(normalizedSource);
    if (cached) return cached;
    const relationships = new Map<string, PptxRelationship>();
    relationshipCache.set(normalizedSource, relationships);
    return relationships;
  };

  const pkg: PptxPackage = {
    files: enrichedFiles,
    getContentType,
    getFile: (path) => enrichedFilesByPath.get(pptxFileUtils.normalizePath(path)),
    getRelationships,
    readText: (path) => readText(path ? filesByPath.get(pptxFileUtils.normalizePath(path)) : undefined),
    warnings,
  };

  for (const sourcePath of ['', ...files.map((file) => file.path)]) {
    const normalizedSource = pptxFileUtils.normalizePath(sourcePath);
    const relationships = parseRelationships(
      await readText(filesByPath.get(relsPathFor(normalizedSource))),
      normalizedSource,
    );
    relationshipCache.set(normalizedSource, relationships);
  }

  if (!filesByPath.has(CONTENT_TYPES_PATH)) {
    warnings.push({
      code: 'pptx-missing-content-types',
      message: 'PowerPoint package is missing [Content_Types].xml; file extensions were used as a fallback.',
      severity: 'warning',
    });
  }

  return pkg;
}

export const pptxPackage = {
  create,
};
