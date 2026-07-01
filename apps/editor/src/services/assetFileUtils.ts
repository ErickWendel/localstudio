export function getAssetFileExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/quicktime') return 'mov';
  return 'png';
}

export function isDataUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('data:'));
}

export function isBlobUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('blob:'));
}

export function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64 = ''] = dataUrl.split(',');
  const mimeType = metadata?.match(/^data:(.*?);base64$/)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export function isReadableObjectUrl(value: string | undefined): value is string {
  return isDataUrl(value) || isBlobUrl(value);
}

export async function objectUrlToBlob(objectUrl: string, requestFetch: typeof fetch = fetch) {
  if (isDataUrl(objectUrl)) return dataUrlToBlob(objectUrl);
  return requestFetch(objectUrl).then((response) => response.blob());
}

export function objectUrlToBlobIfReadable(
  objectUrl: string | undefined,
  requestFetch: typeof fetch | undefined,
) {
  if (!objectUrl) return Promise.resolve(undefined);
  if (isDataUrl(objectUrl)) return Promise.resolve(dataUrlToBlob(objectUrl));
  if (!isBlobUrl(objectUrl) || !requestFetch) return Promise.resolve(undefined);
  return requestFetch(objectUrl).then((response) => response.blob());
}
