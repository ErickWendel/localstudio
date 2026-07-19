function getAssetFileExtension(mimeType: string) {
  if (mimeType.startsWith('audio/ogg')) return 'ogg';
  if (mimeType.startsWith('audio/mp4')) return 'm4a';
  if (mimeType.startsWith('audio/mpeg')) return 'mp3';
  if (mimeType.startsWith('audio/wav')) return 'wav';
  if (mimeType.startsWith('audio/webm')) return 'webm';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';
  if (mimeType === 'video/quicktime') return 'mov';
  return 'png';
}

function isDataUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('data:'));
}

function isBlobUrl(value: string | undefined): value is string {
  return Boolean(value?.startsWith('blob:'));
}

function isSafeRemoteUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, base64 = ''] = dataUrl.split(',');
  const mimeType = metadata?.match(/^data:(.*?);base64$/)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function isReadableObjectUrl(value: string | undefined): value is string {
  return isDataUrl(value) || isBlobUrl(value);
}

function getDefaultFetch() {
  return globalThis.fetch.bind(globalThis);
}

async function objectUrlToBlob(objectUrl: string, requestFetch: typeof fetch = getDefaultFetch()) {
  if (isDataUrl(objectUrl)) return dataUrlToBlob(objectUrl);
  return requestFetch(objectUrl).then((response) => response.blob());
}

function objectUrlToBlobIfReadable(
  objectUrl: string | undefined,
  requestFetch: typeof fetch | undefined,
) {
  if (!objectUrl) return Promise.resolve(undefined);
  if (isDataUrl(objectUrl)) return Promise.resolve(dataUrlToBlob(objectUrl));
  if (!isBlobUrl(objectUrl) || !requestFetch) return Promise.resolve(undefined);
  return requestFetch(objectUrl).then((response) => response.blob());
}

async function remoteObjectUrlToLocalObjectUrl(
  objectUrl: string | undefined,
  mimeType: string,
  requestFetch: typeof fetch | undefined,
) {
  if (!isSafeRemoteUrl(objectUrl) || !requestFetch) return undefined;
  const response = await requestFetch(objectUrl);
  if (!response.ok) return undefined;
  const blob = await response.blob();
  const typedBlob = blob.type ? blob : new Blob([blob], { type: mimeType });
  return URL.createObjectURL(typedBlob);
}

export const assetFileUtils = {
  getAssetFileExtension,
  isDataUrl,
  isBlobUrl,
  isSafeRemoteUrl,
  dataUrlToBlob,
  isReadableObjectUrl,
  objectUrlToBlob,
  objectUrlToBlobIfReadable,
  remoteObjectUrlToLocalObjectUrl,
};
