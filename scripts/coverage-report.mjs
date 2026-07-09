import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const outputDir = join(root, 'coverage-report');
const playwrightCoveragePath = join(root, 'playwright-coverage/coverage-summary.json');

await mkdir(outputDir, { recursive: true });

const playwrightCoverage = await readJsonIfPresent(playwrightCoveragePath);
const totalPercent = playwrightCoverage?.totals.percent ?? 0;
const markdown = renderMarkdownReport(playwrightCoverage);
const summary = {
  generatedAt: new Date().toISOString(),
  e2e: playwrightCoverage ?? null,
};

await writeFile(join(outputDir, 'coverage-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(
  join(outputDir, 'coverage-badge.json'),
  `${JSON.stringify(renderBadge(totalPercent), null, 2)}\n`,
);
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

function renderBadge(coveragePercent) {
  return {
    schemaVersion: 1,
    label: 'e2e coverage',
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

function renderMarkdownReport(coverage) {
  const lines = [
    '# E2E Code Coverage',
    '',
    coverage
      ? `Playwright local browser JavaScript coverage: ${coverage.totals.percent.toFixed(2)}% (${coverage.totals.usedBytes} / ${coverage.totals.totalBytes} bytes).`
      : 'Playwright browser coverage was not available for this run.',
    '',
  ];

  if (coverage?.scripts.length) {
    lines.push(
      '## Lowest Covered Local Scripts',
      '',
      '| Script | Coverage | Tests |',
      '| --- | ---: | ---: |',
      ...coverage.scripts
        .slice()
        .sort((a, b) => a.percent - b.percent || b.totalBytes - a.totalBytes)
        .slice(0, 40)
        .map((script) => `| \`${script.url}\` | ${script.percent.toFixed(2)}% | ${script.testCount} |`),
      '',
    );
  }

  lines.push(
    '## Generated Files',
    '',
    '- `coverage-report/coverage-summary.json`',
    '- `coverage-report/coverage-badge.json`',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function renderHtml(markdown) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>LocalStudio E2E Coverage</title>
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
