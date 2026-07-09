import MCR from 'monocart-coverage-reports';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

const coverageThreshold = 80;
const coverageOutputDir = join(process.cwd(), 'coverage-report');

interface TestCoverageFile {
  entries: MCR.V8CoverageEntry[];
  titlePath: string[];
}

export default async function reportPlaywrightCoverage() {
  if (process.env.E2E_COVERAGE === '0') return;

  const coverageFiles = await findCoverageFiles(join(process.cwd(), 'test-results'));
  if (coverageFiles.length === 0) {
    throw new Error('No browser coverage files were collected from Playwright.');
  }

  await mkdir(coverageOutputDir, { recursive: true });

  const coverageReport = MCR({
    name: 'LocalStudio E2E Coverage',
    outputDir: coverageOutputDir,
    reports: [
      ['v8', { outputFile: 'index.html' }],
      ['v8-json', { outputFile: 'coverage-report.json' }],
      ['json-summary', { file: 'coverage-summary.json' }],
      ['lcovonly', { file: 'lcov.info' }],
      ['markdown-summary', { outputFile: 'coverage-summary.md' }],
      ['markdown-details', { outputFile: 'coverage-details.md', skipPercent: 90 }],
      ['console-summary'],
    ],
    clean: true,
    cleanCache: true,
    entryFilter: isLocalScript,
    sourcePath: normalizeCoverageSourcePath,
    sourceFilter: isReportableSourceFile,
    watermarks: {
      bytes: [coverageThreshold, 90],
      branches: [coverageThreshold, 90],
      functions: [coverageThreshold, 90],
      lines: [coverageThreshold, 90],
      statements: [coverageThreshold, 90],
    },
    onEnd: async (coverageResults) => {
      if (!coverageResults) {
        throw new Error('Monocart did not produce E2E coverage results.');
      }

      await writeBadge(coverageResults);
      await writeCoverageMetadata(coverageResults, coverageFiles);
      enforceCoverageThreshold(coverageResults);
    },
  });

  for (const file of coverageFiles) {
    const payload = JSON.parse(await readFile(file, 'utf8')) as TestCoverageFile;
    await coverageReport.add(payload.entries);
  }

  await coverageReport.generate();
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
  return files.sort();
}

function isLocalScript(entry: MCR.V8CoverageEntry) {
  if (!entry.url) return false;
  if (entry.url.startsWith('file:')) return isSourceFileInCoverageScope(entry.url);
  let parsed: URL;
  try {
    parsed = new URL(entry.url);
  } catch {
    return isSourceFileInCoverageScope(entry.url);
  }
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return false;
  return isSourceFileInCoverageScope(parsed.pathname);
}

function isSourceFileInCoverageScope(sourcePath: string) {
  const normalized = normalizeCoverageSourcePath(sourcePath);
  if (!normalized) return false;
  return isReportableSourceFile(normalized) && isImplementedSourcePath(normalized);
}

function isReportableSourceFile(sourcePath: string) {
  const normalized = normalizeCoverageSourcePath(sourcePath);
  if (!normalized) return false;
  if (
    normalized.includes('/node_modules/') ||
    normalized.includes('/test-results/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/dist/') ||
    normalized.includes('/@vite/') ||
    normalized.includes('/@react-refresh') ||
    normalized.includes('/coverage-report/') ||
    normalized.includes('/playwright-report/') ||
    normalized.includes('/virtual:')
  ) {
    return false;
  }

  return /\.(c|m)?(t|j)sx?$/.test(normalized) || normalized.endsWith('.css');
}

function isImplementedSourcePath(normalized: string) {
  const isImplementedSource =
    normalized.startsWith('apps/') ||
    normalized.startsWith('packages/') ||
    normalized.startsWith('src/') ||
    normalized.includes('/apps/') ||
    normalized.includes('/packages/') ||
    normalized.includes('/src/');
  return isImplementedSource;
}

function normalizeCoverageSourcePath(
  sourcePath: string,
  info?: {
    distFile?: string;
  },
) {
  const source = sourcePath.includes('/') ? sourcePath : (info?.distFile ?? sourcePath);
  let normalized = source.replaceAll('\\', '/').split('?')[0] ?? '';
  normalized = normalized.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1):\d+\//, '');
  normalized = normalized.replace(/^localhost-\d+\//, '');
  normalized = normalized.replace(/^@fs\//, '');
  const workspaceMarker = '/canva-webai-clone/';
  const workspaceIndex = normalized.indexOf(workspaceMarker);
  if (workspaceIndex >= 0) {
    normalized = normalized.slice(workspaceIndex + workspaceMarker.length);
  }
  normalized = normalized.replace(/^\/+/, '');

  if (normalized.startsWith('editor/src/')) return `apps/${normalized}`;
  if (normalized.startsWith('joystick/src/')) return `apps/${normalized}`;
  if (normalized.startsWith('landing/src/')) return `apps/${normalized}`;
  return normalized;
}

async function writeBadge(coverageResults: MCR.CoverageResults) {
  const coveragePercent = getCoveragePercent(coverageResults);
  await writeFile(
    join(coverageOutputDir, 'coverage-badge.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        label: 'e2e coverage',
        message: `${coveragePercent.toFixed(2)}%`,
        color: getBadgeColor(coverageResults),
      },
      null,
      2,
    )}\n`,
  );
}

async function writeCoverageMetadata(
  coverageResults: MCR.CoverageResults,
  coverageFiles: string[],
) {
  const lowCoverageFiles = getLowestCoveredSourceFiles(coverageResults);
  await writeFile(
    join(coverageOutputDir, 'coverage-metadata.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rawCoverageFiles: coverageFiles.map((file) => relative(process.cwd(), file)),
        threshold: {
          metric: 'bytes',
          percent: coverageThreshold,
        },
        total: coverageResults.summary,
        lowestCoveredSourceFiles: lowCoverageFiles,
      },
      null,
      2,
    )}\n`,
  );

  const lines = [
    '# LocalStudio E2E Coverage',
    '',
    `Monocart total byte coverage: ${getCoveragePercent(coverageResults).toFixed(2)}%.`,
    `Threshold: ${coverageThreshold}%.`,
    '',
    '## Reports',
    '',
    '- HTML: `coverage-report/index.html`',
    '- JSON: `coverage-report/coverage-report.json`',
    '- Summary JSON: `coverage-report/coverage-summary.json`',
    '- LCOV: `coverage-report/lcov.info`',
    '',
    '## Lowest Covered Source Files',
    '',
    '| Source | Bytes | Lines |',
    '| --- | ---: | ---: |',
    ...lowCoverageFiles.map(
      (file) =>
        `| \`${file.sourcePath}\` | ${formatPercent(file.bytes)} | ${formatPercent(file.lines)} |`,
    ),
    '',
    '## Raw Playwright Coverage Files',
    '',
    ...coverageFiles.map((file) => `- \`${relative(process.cwd(), file)}\``),
    '',
  ];
  await writeFile(join(coverageOutputDir, 'coverage-ci-summary.md'), `${lines.join('\n')}\n`);
}

function enforceCoverageThreshold(coverageResults: MCR.CoverageResults) {
  const coveragePercent = getCoveragePercent(coverageResults);
  if (coveragePercent < coverageThreshold) {
    throw new Error(
      `E2E coverage threshold not met: ${coveragePercent.toFixed(2)}% bytes < ${coverageThreshold}%.`,
    );
  }
}

function getCoveragePercent(coverageResults: MCR.CoverageResults) {
  const pct = coverageResults.summary.bytes?.pct;
  return typeof pct === 'number' ? pct : 0;
}

function getBadgeColor(coverageResults: MCR.CoverageResults) {
  switch (coverageResults.summary.bytes?.status) {
    case 'high':
      return 'brightgreen';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'red';
    default:
      return 'lightgrey';
  }
}

function getLowestCoveredSourceFiles(coverageResults: MCR.CoverageResults) {
  return coverageResults.files
    .map((file) => ({
      bytes: file.summary.bytes?.pct ?? '',
      lines: file.summary.lines.pct,
      sourcePath: file.sourcePath,
    }))
    .filter((file) => typeof file.bytes === 'number' || typeof file.lines === 'number')
    .sort((a, b) => getSortPercent(a.bytes, a.lines) - getSortPercent(b.bytes, b.lines))
    .slice(0, 20);
}

function getSortPercent(bytes: number | '', lines: number | '') {
  if (typeof bytes === 'number') return bytes;
  if (typeof lines === 'number') return lines;
  return Number.POSITIVE_INFINITY;
}

function formatPercent(percent: number | '') {
  return typeof percent === 'number' ? `${percent.toFixed(2)}%` : 'n/a';
}
