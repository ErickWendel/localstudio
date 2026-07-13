import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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

  async resolveSourceMap(
    url: string,
    defaultResolver: (url: string) => Promise<unknown>,
  ): Promise<unknown> {
    const localDistSourceMap = await getLocalDistSourceMap(url);
    if (localDistSourceMap !== undefined) return localDistSourceMap;
    return defaultResolver(url);
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
  const localDistSource = await getLocalDistScriptSource(url);
  if (localDistSource !== undefined) return localDistSource;

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

async function getLocalDistScriptSource(url: string) {
  return readLocalDistText(url, (path) => path.endsWith('.js'));
}

async function getLocalDistSourceMap(url: string): Promise<Record<string, unknown> | undefined> {
  const sourceMap = await readLocalDistText(url, (path) => path.endsWith('.map'));
  if (sourceMap === undefined) return undefined;
  const parsed = JSON.parse(sourceMap) as unknown;
  return isRecord(parsed) ? parsed : undefined;
}

async function readLocalDistText(url: string, includePath: (path: string) => boolean) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  const path = parsed.pathname.replace(/^\/+/, '');
  if (!includePath(path)) return undefined;
  try {
    return await readFile(join(process.cwd(), 'dist', path), 'utf8');
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
