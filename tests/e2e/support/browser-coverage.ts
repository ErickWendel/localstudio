import type { CDPSession, BrowserContext, Page, TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

interface ScriptCoverageEntry {
  functions: unknown[];
  scriptId: string;
  source?: string;
  url: string;
}

interface BrowserCoverageFixtureInput {
  browserName: string;
  context: BrowserContext;
}

const cdpCoverageTimeoutMs = 5_000;
const cdpSourceTimeoutMs = 1_000;
const httpSourceTimeoutMs = 5_000;

export async function collectBrowserCoverage(
  { browserName, context }: BrowserCoverageFixtureInput,
  runTest: () => Promise<void>,
  testInfo: TestInfo,
) {
  if (!shouldCollectBrowserCoverage(browserName)) {
    await runTest();
    return;
  }

  const sessions = new Map<Page, CDPSession>();
  const startCoverage = async (page: Page) => {
    if (sessions.has(page)) return;
    try {
      const client = await context.newCDPSession(page);
      await client.send('Debugger.enable');
      await client.send('Profiler.enable');
      await client.send('Profiler.startPreciseCoverage', {
        callCount: true,
        detailed: true,
      });
      sessions.set(page, client);
    } catch {
      // CDP coverage is Chromium-only and can fail for pages closed during setup.
    }
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

  const entries: unknown[] = [];
  for (const client of sessions.values()) {
    try {
      const coverage = await withTimeout(
        client.send('Profiler.takePreciseCoverage') as Promise<{
          result: ScriptCoverageEntry[];
        }>,
        cdpCoverageTimeoutMs,
      );
      const entriesWithSource = await Promise.all(
        coverage.result.map(async (entry) => ({
          ...entry,
          source: shouldFetchScriptSource(entry)
            ? await getScriptSource(client, entry)
            : entry.source,
        })),
      );
      entries.push(...entriesWithSource);
      await withTimeout(client.send('Profiler.stopPreciseCoverage'), cdpCoverageTimeoutMs);
      await withTimeout(client.send('Profiler.disable'), cdpCoverageTimeoutMs);
      await withTimeout(client.send('Debugger.disable'), cdpCoverageTimeoutMs);
      await withTimeout(client.detach(), cdpCoverageTimeoutMs);
    } catch {
      // Closed popups still contribute through earlier pages; ignore late teardown races.
    }
  }

  if (testError instanceof Error) throw testError;
  if (testError) throw new Error(getErrorMessage(testError));
  if (entries.length === 0) return;
  const outputPath = testInfo.outputPath('browser-coverage.json');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        entries,
        projectName: testInfo.project.name,
        testId: testInfo.testId,
        titlePath: testInfo.titlePath,
      },
      null,
      2,
    ),
  );
}

async function getScriptSource(client: CDPSession, entry: ScriptCoverageEntry) {
  const httpSource = await getScriptSourceOverHttp(entry);
  if (httpSource) return httpSource;

  try {
    const scriptSource = await withTimeout(
      client.send('Debugger.getScriptSource', {
        scriptId: entry.scriptId,
      }) as Promise<{ scriptSource?: string }>,
      cdpSourceTimeoutMs,
    );
    return scriptSource.scriptSource ?? entry.source;
  } catch {
    return entry.source;
  }
}

async function getScriptSourceOverHttp(entry: ScriptCoverageEntry) {
  if (!isLocalHttpUrl(entry.url)) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), httpSourceTimeoutMs);
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

function shouldFetchScriptSource(entry: ScriptCoverageEntry) {
  const path = getCoveragePath(entry.url);
  if (!path) return false;
  if (
    path.includes('/node_modules/') ||
    path.includes('/@vite/') ||
    path.includes('/@react-refresh') ||
    path.includes('/tests/') ||
    path.includes('/test-results/') ||
    path.includes('/coverage-report/') ||
    path.includes('/playwright-report/') ||
    path.includes('/vendor/') ||
    path.includes('/dist/') ||
    path.endsWith('.d.ts') ||
    path.endsWith('/vite-env.d.ts') ||
    path.endsWith('/vite.config.ts') ||
    path.endsWith('/main.tsx')
  ) {
    return false;
  }
  return (
    /\.(c|m)?(t|j)sx?$/.test(path) &&
    (path.includes('/apps/') ||
      path.includes('/packages/') ||
      path.includes('/src/') ||
      path.startsWith('apps/') ||
      path.startsWith('packages/') ||
      path.startsWith('src/') ||
      path.startsWith('editor/src/') ||
      path.startsWith('joystick/src/') ||
      path.startsWith('landing/src/'))
  );
}

function getCoveragePath(url: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return '';
    return parsed.pathname.replace(/^\/@fs\//, '/').split('?')[0] ?? '';
  } catch {
    return url.replace(/^@fs\//, '').split('?')[0] ?? '';
  }
}

function isLocalHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol.startsWith('http') && ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function shouldCollectBrowserCoverage(browserName: string) {
  return browserName === 'chromium' && process.env.E2E_COVERAGE !== '0';
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown Playwright test error';
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`CDP coverage command timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
