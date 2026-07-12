import { browserCoverageConfig } from './browser-coverage-config';
import { browserCoveragePath } from './browser-coverage-path';
import type { ScriptCoverageEntry } from './browser-coverage-types';
import { normalizeCoverageSourcePath } from './coverage-source-path-normalizer';

const sourceCache = new Map<string, Promise<string | undefined>>();

export const coverageReportSource = {
  async hydrate(entries: ScriptCoverageEntry[]): Promise<ScriptCoverageEntry[]> {
    return Promise.all(
      entries.map(async (entry) => {
        if (entry.source || !browserCoveragePath.shouldFetchSource(entry.url)) return entry;
        const source = await getSource(entry.url);
        return source === undefined ? entry : { ...entry, source };
      }),
    );
  },
};

async function getSource(url: string) {
  const cacheKey = getSourceCacheKey(url);
  let cached = sourceCache.get(cacheKey);
  if (!cached) {
    cached = getScriptSourceOverHttp(url);
    sourceCache.set(cacheKey, cached);
  }
  return cached;
}

function getSourceCacheKey(url: string) {
  return normalizeCoverageSourcePath(browserCoveragePath.fromUrl(url)) || url;
}

async function getScriptSourceOverHttp(url: string) {
  if (!browserCoveragePath.isLocalHttpUrl(url)) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), browserCoverageConfig.httpSourceTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return undefined;
    return await response.text();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
