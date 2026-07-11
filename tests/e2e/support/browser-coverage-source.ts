import type { CDPSession } from '@playwright/test';

import { browserCoverageConfig } from './browser-coverage-config';
import { browserCoveragePath } from './browser-coverage-path';
import { withCoverageTimeout } from './browser-coverage-timeout';
import type { ScriptCoverageEntry } from './browser-coverage-types';

export const browserCoverageSource = {
  async get(client: CDPSession, entry: ScriptCoverageEntry): Promise<string | undefined> {
    const httpSource = await getScriptSourceOverHttp(entry);
    if (httpSource) return httpSource;

    try {
      const scriptSource = await withCoverageTimeout(
        client.send('Debugger.getScriptSource', {
          scriptId: entry.scriptId,
        }) as Promise<{ scriptSource?: string }>,
        browserCoverageConfig.cdpSourceTimeoutMs,
        'Debugger.getScriptSource',
      );
      return scriptSource.scriptSource ?? entry.source;
    } catch {
      return entry.source;
    }
  },

  shouldFetch(entry: ScriptCoverageEntry): boolean {
    return browserCoveragePath.shouldFetchSource(entry.url);
  },
};

async function getScriptSourceOverHttp(entry: ScriptCoverageEntry) {
  if (!browserCoveragePath.isLocalHttpUrl(entry.url)) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), browserCoverageConfig.httpSourceTimeoutMs);
  try {
    const response = await fetch(entry.url, { signal: controller.signal });
    if (!response.ok) return undefined;
    return await response.text();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
