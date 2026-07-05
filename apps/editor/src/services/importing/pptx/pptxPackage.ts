import type { ImportWarning } from '../../../domain/documents/model';
import type { PptxPackageFile } from './pptxPackageTypes';
import { pptxFileUtils } from './pptxFileUtils';
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

async function create(files: PptxPackageFile[]): Promise<PptxPackage> {
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const { defaults, overrides } = parseContentTypes(await readText(filesByPath.get(CONTENT_TYPES_PATH)));
  const relationshipCache = new Map<string, Map<string, PptxRelationship>>();
  const warnings: ImportWarning[] = [];

  const getContentType = (path: string) =>
    overrides.get(pptxFileUtils.normalizePath(path)) ??
    defaults.get(extensionFor(path)) ??
    pptxFileUtils.getMimeType(path);

  const getRelationships = (sourcePath: string) => {
    const normalizedSource = pptxFileUtils.normalizePath(sourcePath);
    const cached = relationshipCache.get(normalizedSource);
    if (cached) return cached;
    const relationships = new Map<string, PptxRelationship>();
    relationshipCache.set(normalizedSource, relationships);
    return relationships;
  };

  const pkg: PptxPackage = {
    files,
    getContentType,
    getFile: (path) => filesByPath.get(pptxFileUtils.normalizePath(path)),
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
