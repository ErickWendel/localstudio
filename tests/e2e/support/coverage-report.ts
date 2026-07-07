import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

interface CoverageRange {
  count: number;
  endOffset: number;
  startOffset: number;
}

interface FunctionCoverage {
  functionName: string;
  ranges: CoverageRange[];
}

interface ScriptCoverage {
  functions: FunctionCoverage[];
  url: string;
}

interface TestCoverageFile {
  entries: ScriptCoverage[];
  titlePath: string[];
}

interface ScriptSummary {
  testCount: number;
  totalBytes: number;
  usedBytes: number;
  url: string;
}

export default async function reportPlaywrightCoverage() {
  if (process.env.E2E_COVERAGE === '0') return;

  const coverageFiles = await findCoverageFiles(join(process.cwd(), 'test-results'));
  const summaries = new Map<string, ScriptSummary>();

  for (const file of coverageFiles) {
    const payload = JSON.parse(await readFile(file, 'utf8')) as TestCoverageFile;
    const seenInTest = new Set<string>();
    for (const entry of payload.entries) {
      if (!isLocalScript(entry.url)) continue;
      const summary = summarizeScript(entry);
      if (summary.totalBytes <= 0) continue;
      const url = normalizeScriptUrl(entry.url);
      const current = summaries.get(url) ?? {
        testCount: 0,
        totalBytes: 0,
        usedBytes: 0,
        url,
      };
      current.totalBytes += summary.totalBytes;
      current.usedBytes += summary.usedBytes;
      if (!seenInTest.has(url)) {
        current.testCount += 1;
        seenInTest.add(url);
      }
      summaries.set(url, current);
    }
  }

  const scriptSummaries = Array.from(summaries.values())
    .map((summary) => ({
      ...summary,
      percent: summary.totalBytes === 0 ? 0 : (summary.usedBytes / summary.totalBytes) * 100,
    }))
    .sort((a, b) => a.percent - b.percent || b.totalBytes - a.totalBytes);

  const totalBytes = scriptSummaries.reduce((total, summary) => total + summary.totalBytes, 0);
  const usedBytes = scriptSummaries.reduce((total, summary) => total + summary.usedBytes, 0);
  const totalPercent = totalBytes === 0 ? 0 : (usedBytes / totalBytes) * 100;
  const outputDir = join(process.cwd(), 'playwright-coverage');
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, 'coverage-summary.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        localScriptCount: scriptSummaries.length,
        totals: {
          percent: Number(totalPercent.toFixed(2)),
          totalBytes,
          usedBytes,
        },
        scripts: scriptSummaries.map((summary) => ({
          ...summary,
          percent: Number(summary.percent.toFixed(2)),
        })),
      },
      null,
      2,
    ),
  );
  await writeFile(join(outputDir, 'coverage-summary.md'), renderMarkdownReport({
    coverageFiles,
    scriptSummaries,
    totalBytes,
    totalPercent,
    usedBytes,
  }));
}

async function findCoverageFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.name === 'browser-coverage.json') {
        files.push(path);
      }
    }
  }
  await walk(root);
  return files;
}

function summarizeScript(entry: ScriptCoverage) {
  const totalBytes = getScriptLength(entry);
  const functionRanges = entry.functions
    .map((fn) => getFunctionRange(fn))
    .filter((range): range is CoverageRange => {
      if (!range) return false;
      const isWholeScriptTopLevel =
        range.startOffset === 0 && range.endOffset === totalBytes && range.count > 0;
      return !isWholeScriptTopLevel;
    });
  const coveredRanges = functionRanges
    .filter((range) => range.count > 0)
    .map((range) => ({
      end: range.endOffset,
      start: range.startOffset,
    }));
  return {
    totalBytes:
      functionRanges.length > 0
        ? measureCoveredBytes(
            functionRanges.map((range) => ({
              end: range.endOffset,
              start: range.startOffset,
            })),
          )
        : totalBytes,
    usedBytes: measureCoveredBytes(coveredRanges),
  };
}

function getFunctionRange(fn: FunctionCoverage) {
  return fn.ranges
    .filter((range) => range.endOffset > range.startOffset)
    .sort((a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset))[0];
}

function getScriptLength(entry: ScriptCoverage) {
  return Math.max(
    0,
    ...entry.functions.flatMap((fn) => fn.ranges.map((range) => range.endOffset)),
  );
}

function measureCoveredBytes(ranges: Array<{ end: number; start: number }>) {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let covered = 0;
  let current: { end: number; start: number } | undefined;
  for (const range of sorted) {
    if (!current) {
      current = { ...range };
      continue;
    }
    if (range.start <= current.end) {
      current.end = Math.max(current.end, range.end);
      continue;
    }
    covered += current.end - current.start;
    current = { ...range };
  }
  if (current) covered += current.end - current.start;
  return covered;
}

function isLocalScript(url: string) {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return false;
  if (parsed.pathname.includes('/node_modules/')) return false;
  if (parsed.pathname.includes('/@vite/') || parsed.pathname.includes('/@react-refresh')) return false;
  return parsed.pathname.endsWith('.js') || parsed.pathname.includes('/src/');
}

function normalizeScriptUrl(url: string) {
  const parsed = new URL(url);
  return parsed.pathname;
}

function renderMarkdownReport(input: {
  coverageFiles: string[];
  scriptSummaries: Array<ScriptSummary & { percent: number }>;
  totalBytes: number;
  totalPercent: number;
  usedBytes: number;
}) {
  const lowestCovered = input.scriptSummaries.slice(0, 40);
  const lines = [
    '# Playwright Browser Coverage',
    '',
    `Collected ${input.coverageFiles.length} per-test coverage files.`,
    `Local browser JavaScript coverage: ${input.totalPercent.toFixed(2)}% (${input.usedBytes} / ${input.totalBytes} bytes).`,
    '',
    '## Lowest Covered Local Scripts',
    '',
    '| Script | Coverage | Tests |',
    '| --- | ---: | ---: |',
    ...lowestCovered.map(
      (summary) =>
        `| \`${summary.url}\` | ${summary.percent.toFixed(2)}% | ${summary.testCount} |`,
    ),
    '',
    '## Raw Files',
    '',
    ...input.coverageFiles.map((file) => `- \`${relative(process.cwd(), file)}\``),
    '',
  ];
  return `${lines.join('\n')}\n`;
}
