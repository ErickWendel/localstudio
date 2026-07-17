import type { ProjectDocument } from '../../domain/documents/model';

interface PublicDeckAssetPreloadOptions {
  fetchImpl?: typeof fetch | undefined;
  signal?: AbortSignal | undefined;
}

const PUBLIC_DECK_PRELOAD_CONCURRENCY = 4;

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
  const urls = new Set<string>();
  for (const asset of Object.values(project.assets)) {
    const url = normalizePreloadUrl(asset.objectUrl);
    if (url) urls.add(url);
  }
  for (const font of Object.values(project.fonts ?? {})) {
    const objectUrl = normalizePreloadUrl(font.objectUrl);
    const sourceUrl = normalizePreloadUrl(font.sourceUrl);
    if (objectUrl) urls.add(objectUrl);
    if (sourceUrl) urls.add(sourceUrl);
  }
  return Array.from(urls);
}

async function preloadUrl(url: string, options: PublicDeckAssetPreloadOptions) {
  const fetchImpl = getFetchImpl(options);
  if (!fetchImpl || options.signal?.aborted) return;
  const requestInit: RequestInit = {
    cache: 'force-cache',
    credentials: 'omit',
    mode: 'cors',
    ...(options.signal ? { signal: options.signal } : {}),
  };
  await fetchImpl(url, requestInit).catch(() => undefined);
}

async function preloadUrlQueue(urls: string[], options: PublicDeckAssetPreloadOptions) {
  let nextIndex = 0;
  async function worker() {
    while (!options.signal?.aborted) {
      const url = urls[nextIndex];
      nextIndex += 1;
      if (!url) return;
      await preloadUrl(url, options);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PUBLIC_DECK_PRELOAD_CONCURRENCY, urls.length) }, () => worker()),
  );
}

export function preloadPublicDeckAssets(
  project: ProjectDocument,
  options: PublicDeckAssetPreloadOptions = {},
) {
  const urls = collectPublicDeckAssetUrls(project);
  if (urls.length === 0) return Promise.resolve();
  return preloadUrlQueue(urls, options);
}
