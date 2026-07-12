import type { BrowserContext, CDPSession, Page } from '@playwright/test';

import { browserCoverageConfig } from './browser-coverage-config';
import { withCoverageTimeout } from './browser-coverage-timeout';
import type { BrowserCoverageSession, ScriptCoverageEntry } from './browser-coverage-types';

export const browserCoverageSession = {
  async start(context: BrowserContext, page: Page): Promise<BrowserCoverageSession | undefined> {
    try {
      const client = await context.newCDPSession(page);
      await client.send('Debugger.enable');
      await client.send('Profiler.enable');
      await client.send('Profiler.startPreciseCoverage', {
        callCount: true,
        detailed: true,
      });
      return {
        page,
        stop: () => stopCoverage(client),
      };
    } catch {
      // CDP coverage is Chromium-only and can fail for pages closed during setup.
      return undefined;
    }
  },
};

async function stopCoverage(client: CDPSession): Promise<ScriptCoverageEntry[]> {
  const coverage = await withCoverageTimeout(
    client.send('Profiler.takePreciseCoverage') as Promise<{
      result: ScriptCoverageEntry[];
    }>,
    browserCoverageConfig.cdpCoverageTimeoutMs,
    'Profiler.takePreciseCoverage',
  );
  await withCoverageTimeout(
    client.send('Profiler.stopPreciseCoverage'),
    browserCoverageConfig.cdpCoverageTimeoutMs,
    'Profiler.stopPreciseCoverage',
  );
  await withCoverageTimeout(
    client.send('Profiler.disable'),
    browserCoverageConfig.cdpCoverageTimeoutMs,
    'Profiler.disable',
  );
  await withCoverageTimeout(
    client.send('Debugger.disable'),
    browserCoverageConfig.cdpCoverageTimeoutMs,
    'Debugger.disable',
  );
  await withCoverageTimeout(
    client.detach(),
    browserCoverageConfig.cdpCoverageTimeoutMs,
    'CDP detach',
  );
  return coverage.result;
}
