import type { TestInfo } from '@playwright/test';

import { browserCoverageOutput } from './browser-coverage-output';
import { browserCoveragePath } from './browser-coverage-path';
import { browserCoverageSession } from './browser-coverage-session';
import type {
  BrowserCoverageFixtureInput,
  BrowserCoverageSession,
  ScriptCoverageEntry,
} from './browser-coverage-types';

export async function collectBrowserCoverage(
  { browserName, context }: BrowserCoverageFixtureInput,
  runTest: () => Promise<void>,
  testInfo: TestInfo,
) {
  if (!browserCoveragePath.shouldCollect(browserName)) {
    await runTest();
    return;
  }

  const sessions = new Map<BrowserCoverageSession['page'], BrowserCoverageSession>();
  const startCoverage = async (page: BrowserCoverageSession['page']) => {
    if (sessions.has(page)) return;
    const session = await browserCoverageSession.start(context, page);
    if (session) sessions.set(page, session);
  };

  context.on('page', (page) => {
    void startCoverage(page);
  });
  await Promise.all(context.pages().map((page) => startCoverage(page)));

  let testError: unknown;
  try {
    await runTest();
  } catch (error) {
    testError = error;
  }

  const entries: ScriptCoverageEntry[] = [];
  for (const client of sessions.values()) {
    try {
      entries.push(...(await client.stop()));
    } catch {
      // Closed popups still contribute through earlier pages; ignore late teardown races.
    }
  }

  if (testError instanceof Error) throw testError;
  if (testError) throw new Error(getErrorMessage(testError));
  await browserCoverageOutput.write(entries, testInfo);
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown Playwright test error';
  }
}
