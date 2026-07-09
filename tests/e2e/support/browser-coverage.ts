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

  await runTest();

  const entries: unknown[] = [];
  for (const client of sessions.values()) {
    try {
      const coverage = (await client.send('Profiler.takePreciseCoverage')) as {
        result: ScriptCoverageEntry[];
      };
      const entriesWithSource = await Promise.all(
        coverage.result.map(async (entry) => ({
          ...entry,
          source: await getScriptSource(client, entry),
        })),
      );
      entries.push(...entriesWithSource);
      await client.send('Profiler.stopPreciseCoverage');
      await client.send('Profiler.disable');
      await client.send('Debugger.disable');
      await client.detach();
    } catch {
      // Closed popups still contribute through earlier pages; ignore late teardown races.
    }
  }

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
  try {
    const scriptSource = (await client.send('Debugger.getScriptSource', {
      scriptId: entry.scriptId,
    })) as { scriptSource?: string };
    return scriptSource.scriptSource ?? entry.source;
  } catch {
    return entry.source;
  }
}

function shouldCollectBrowserCoverage(browserName: string) {
  return browserName === 'chromium' && process.env.E2E_COVERAGE !== '0';
}
