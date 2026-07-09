import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputDir = join(root, 'coverage-report');
const unitCoverageInputs = [
  ['Landing', 'apps/landing/coverage/coverage-summary.json'],
  ['Editor', 'apps/editor/coverage/coverage-summary.json'],
  ['Joystick', 'apps/joystick/coverage/coverage-summary.json'],
];
const e2eCoveragePath = 'playwright-coverage/coverage-summary.json';

await mkdir(outputDir, { recursive: true });

const unitReports = [];
for (const [name, path] of unitCoverageInputs) {
  const summary = await readJsonIfPresent(join(root, path));
  if (summary) unitReports.push({ name, path, summary });
}

const totals = combineIstanbulTotals(unitReports.map((report) => report.summary.total));
const e2eCoverage = await readJsonIfPresent(join(root, e2eCoveragePath));
const markdown = renderMarkdownReport({ e2eCoverage, totals, unitReports });
const badge = renderBadge(totals.lines.pct);
const summary = {
  generatedAt: new Date().toISOString(),
  unit: {
    totals,
    workspaces: unitReports.map((report) => ({
      name: report.name,
      path: report.path,
      total: normalizeIstanbulTotal(report.summary.total),
    })),
  },
  e2e: e2eCoverage ?? null,
};

await writeFile(join(outputDir, 'coverage-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(join(outputDir, 'coverage-badge.json'), `${JSON.stringify(badge, null, 2)}\n`);
await writeFile(join(outputDir, 'coverage-summary.md'), markdown);
await writeFile(join(outputDir, 'index.html'), renderHtml(markdown));

async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function combineIstanbulTotals(items) {
  return normalizeIstanbulTotal(
    items.reduce(
      (combined, item) => {
        for (const key of ['lines', 'statements', 'functions', 'branches']) {
          combined[key].covered += item[key]?.covered ?? 0;
          combined[key].total += item[key]?.total ?? 0;
        }
        return combined;
      },
      {
        branches: { covered: 0, total: 0 },
        functions: { covered: 0, total: 0 },
        lines: { covered: 0, total: 0 },
        statements: { covered: 0, total: 0 },
      },
    ),
  );
}

function normalizeIstanbulTotal(total) {
  const normalized = {};
  for (const key of ['lines', 'statements', 'functions', 'branches']) {
    const covered = total[key]?.covered ?? 0;
    const metricTotal = total[key]?.total ?? 0;
    normalized[key] = {
      covered,
      total: metricTotal,
      pct: metricTotal === 0 ? 100 : Number(((covered / metricTotal) * 100).toFixed(2)),
    };
  }
  return normalized;
}

function renderBadge(coveragePercent) {
  return {
    schemaVersion: 1,
    label: 'coverage',
    message: `${coveragePercent.toFixed(2)}%`,
    color: getCoverageColor(coveragePercent),
  };
}

function getCoverageColor(coveragePercent) {
  if (coveragePercent >= 90) return 'brightgreen';
  if (coveragePercent >= 80) return 'green';
  if (coveragePercent >= 70) return 'yellowgreen';
  if (coveragePercent >= 60) return 'yellow';
  if (coveragePercent >= 50) return 'orange';
  return 'red';
}

function renderMarkdownReport({ e2eCoverage, totals, unitReports }) {
  const lines = [
    '# Code Coverage',
    '',
    `Unit line coverage: ${totals.lines.pct.toFixed(2)}% (${totals.lines.covered} / ${totals.lines.total}).`,
    '',
    '## Unit Coverage',
    '',
    '| Workspace | Lines | Statements | Functions | Branches |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...unitReports.map((report) => {
      const total = normalizeIstanbulTotal(report.summary.total);
      return `| ${report.name} | ${formatMetric(total.lines)} | ${formatMetric(total.statements)} | ${formatMetric(total.functions)} | ${formatMetric(total.branches)} |`;
    }),
    `| **Total** | **${formatMetric(totals.lines)}** | **${formatMetric(totals.statements)}** | **${formatMetric(totals.functions)}** | **${formatMetric(totals.branches)}** |`,
    '',
    '## Browser Coverage',
    '',
    e2eCoverage
      ? `Playwright local browser JavaScript coverage: ${e2eCoverage.totals.percent.toFixed(2)}% (${e2eCoverage.totals.usedBytes} / ${e2eCoverage.totals.totalBytes} bytes).`
      : 'Playwright browser coverage was not available for this run.',
    '',
    '## Generated Files',
    '',
    `- \`${relative(root, join(outputDir, 'coverage-summary.json'))}\``,
    `- \`${relative(root, join(outputDir, 'coverage-badge.json'))}\``,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function formatMetric(metric) {
  return `${metric.pct.toFixed(2)}% (${metric.covered} / ${metric.total})`;
}

function renderHtml(markdown) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>LocalStudio Coverage</title>
    <style>
      body { color: #172026; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 0; padding: 32px; }
      main { max-width: 960px; margin: 0 auto; }
      pre { background: #f4f6f8; border: 1px solid #d9e0e7; border-radius: 8px; overflow: auto; padding: 16px; }
    </style>
  </head>
  <body>
    <main>
      <pre>${escapeHtml(markdown)}</pre>
    </main>
  </body>
</html>
`;
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
