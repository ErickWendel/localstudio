import type { ProjectDocument } from '../../domain/documents/model';
import { canvasWorkspaceUtils } from '../editor/canvas/canvasWorkspaceUtils';

interface PublicDeckAssetPreloadOptions {
  fetchImpl?: typeof fetch | undefined;
  onProgress?: (progress: PublicDeckAssetPreloadProgress) => void;
  signal?: AbortSignal | undefined;
}

const PUBLIC_DECK_PRELOAD_CONCURRENCY = 4;
const PUBLIC_DECK_PRELOAD_TIMEOUT_MS = 5000;

export interface PublicDeckAssetPreloadProgress {
  loaded: number;
  total: number;
}

function getFetchImpl(options: PublicDeckAssetPreloadOptions) {
  if (options.fetchImpl) return options.fetchImpl;
  if (typeof fetch === 'undefined') return undefined;
  return fetch.bind(globalThis);
}

function normalizePreloadUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function collectPublicDeckAssetUrls(project: ProjectDocument) {
  const imageUrls = new Set<string>();
  const requestUrls = new Set<string>();
  const videoUrls = new Set<string>();
  for (const asset of Object.values(project.assets)) {
    const url = normalizePreloadUrl(asset.objectUrl);
    if (!url) continue;
    if (asset.type === 'image' || asset.type === 'gif') {
      imageUrls.add(url);
    } else if (asset.type === 'video') {
      videoUrls.add(url);
    } else {
      requestUrls.add(url);
    }
  }
  for (const font of Object.values(project.fonts ?? {})) {
    const objectUrl = normalizePreloadUrl(font.objectUrl);
    const sourceUrl = normalizePreloadUrl(font.sourceUrl);
    if (objectUrl) requestUrls.add(objectUrl);
    if (sourceUrl) requestUrls.add(sourceUrl);
  }
  return {
    imageUrls: Array.from(imageUrls),
    requestUrls: Array.from(requestUrls),
    videoUrls: Array.from(videoUrls),
  };
}

async function preloadUrl(url: string, options: PublicDeckAssetPreloadOptions) {
  const fetchImpl = getFetchImpl(options);
  if (!fetchImpl || options.signal?.aborted) return;
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => {
    timeoutController.abort();
  }, PUBLIC_DECK_PRELOAD_TIMEOUT_MS);
  const abortPreload = () => {
    timeoutController.abort();
  };
  options.signal?.addEventListener('abort', abortPreload, { once: true });
  const requestInit: RequestInit = {
    cache: 'force-cache',
    credentials: 'omit',
    mode: 'cors',
    signal: timeoutController.signal,
  };
  try {
    await fetchImpl(url, requestInit).catch(() => undefined);
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortPreload);
  }
}

async function preloadCanvasImageUrl(url: string, options: PublicDeckAssetPreloadOptions) {
  if (options.signal?.aborted) return;
  let timeoutId: number | undefined;
  let resolveTimeout: (() => void) | undefined;
  const clearPreloadTimeout = () => {
    if (timeoutId === undefined) return;
    window.clearTimeout(timeoutId);
    timeoutId = undefined;
  };
  const abortPreload = () => {
    clearPreloadTimeout();
    resolveTimeout?.();
  };
  const timeoutPromise = new Promise<void>((resolve) => {
    resolveTimeout = resolve;
    timeoutId = window.setTimeout(resolve, PUBLIC_DECK_PRELOAD_TIMEOUT_MS);
    options.signal?.addEventListener('abort', abortPreload, { once: true });
  });
  try {
    await Promise.race([
      canvasWorkspaceUtils.preloadCanvasImage(url).then(() => undefined, () => undefined),
      timeoutPromise,
    ]);
  } finally {
    clearPreloadTimeout();
    resolveTimeout = undefined;
    options.signal?.removeEventListener('abort', abortPreload);
  }
}

async function preloadVideoUrl(url: string, options: PublicDeckAssetPreloadOptions) {
  if (options.signal?.aborted) return;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  await new Promise<void>((resolve) => {
    let timeoutId: number | undefined;
    const finish = () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      video.removeEventListener('loadeddata', finish);
      video.removeEventListener('error', finish);
      options.signal?.removeEventListener('abort', finish);
      video.removeAttribute('src');
      video.load();
      resolve();
    };

    timeoutId = window.setTimeout(finish, PUBLIC_DECK_PRELOAD_TIMEOUT_MS);
    video.addEventListener('loadeddata', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    options.signal?.addEventListener('abort', finish, { once: true });
    video.src = url;
    video.load();
  });
}

async function preloadUrlQueue(
  entries: Array<{ type: 'image' | 'request' | 'video'; url: string }>,
  options: PublicDeckAssetPreloadOptions,
) {
  let nextIndex = 0;
  let loaded = 0;
  async function worker() {
    while (!options.signal?.aborted) {
      const entry = entries[nextIndex];
      nextIndex += 1;
      if (!entry) return;
      if (entry.type === 'image') {
        await preloadCanvasImageUrl(entry.url, options);
      } else if (entry.type === 'video') {
        await preloadVideoUrl(entry.url, options);
      } else {
        await preloadUrl(entry.url, options);
      }
      loaded += 1;
      options.onProgress?.({ loaded, total: entries.length });
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PUBLIC_DECK_PRELOAD_CONCURRENCY, entries.length) }, () => worker()),
  );
}

export function preloadPublicDeckAssets(
  project: ProjectDocument,
  options: PublicDeckAssetPreloadOptions = {},
) {
  const { imageUrls, requestUrls, videoUrls } = collectPublicDeckAssetUrls(project);
  const entries: Array<{ type: 'image' | 'request' | 'video'; url: string }> = [
    ...imageUrls.map((url) => ({ type: 'image' as const, url })),
    ...videoUrls.map((url) => ({ type: 'video' as const, url })),
    ...requestUrls.map((url) => ({ type: 'request' as const, url })),
  ];
  if (entries.length === 0) return Promise.resolve();
  options.onProgress?.({ loaded: 0, total: entries.length });
  return preloadUrlQueue(entries, options);
}
