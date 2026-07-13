import type { Asset } from '../../../domain/documents/model';

function normalizePath(path: string) {
  const segments: string[] = [];
  for (const segment of path.replace(/^\/+/, '').replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

function resolveRelativePath(basePath: string, target: string) {
  const baseDirectory = basePath.split('/').slice(0, -1).join('/');
  return normalizePath(`${baseDirectory}/${target}`);
}

function getMimeType(path: string, fallback = 'application/octet-stream') {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerPath.endsWith('.png')) return 'image/png';
  if (lowerPath.endsWith('.svg')) return 'image/svg+xml';
  if (lowerPath.endsWith('.gif')) return 'image/gif';
  if (lowerPath.endsWith('.mp4')) return 'video/mp4';
  if (lowerPath.endsWith('.mov')) return 'video/quicktime';
  if (lowerPath.endsWith('.webm')) return 'video/webm';
  if (lowerPath.endsWith('.tif') || lowerPath.endsWith('.tiff')) return 'image/tiff';
  if (lowerPath.endsWith('.xml')) return 'application/xml';
  if (lowerPath.endsWith('.rels')) return 'application/xml';
  return fallback;
}

function getAssetType(path: string, mimeType: string): Asset['type'] | undefined {
  const lowerPath = path.toLowerCase();
  if (mimeType === 'image/gif' || lowerPath.endsWith('.gif')) return 'gif';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return undefined;
}

function createObjectUrl(blob: Blob) {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  return undefined;
}

export const pptxFileUtils = {
  createObjectUrl,
  getAssetType,
  getMimeType,
  normalizePath,
  resolveRelativePath,
};
