import MCR from 'monocart-coverage-reports';
import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

import type { CoverageScope } from './coverage-report-config';
import { coverageReportConfig } from './coverage-report-config';

export const coverageArtifacts = {
  async writeBadge(coverageResults: MCR.CoverageResults, outputDir: string, scope: CoverageScope) {
    const coveragePercent = getCoveragePercent(coverageResults);
    await writeFile(
      join(outputDir, 'coverage-badge.json'),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          label: `${coverageReportConfig.getScopeLabel(scope).toLowerCase()} e2e coverage`,
          message: `${coveragePercent.toFixed(2)}%`,
          color: getBadgeColor(coverageResults),
        },
        null,
        2,
      )}\n`,
    );
  },

  async writeMetadata(
    coverageResults: MCR.CoverageResults,
    coverageFiles: string[],
    outputDir: string,
    scope: CoverageScope,
  ) {
    const lowCoverageFiles = getLowestCoveredSourceFiles(coverageResults);
    await writeFile(
      join(outputDir, 'coverage-metadata.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          rawCoverageFiles: coverageFiles.map((file) => relative(process.cwd(), file)),
          threshold: {
            metric: 'bytes',
            percent: coverageReportConfig.threshold,
          },
          total: coverageResults.summary,
          lowestCoveredSourceFiles: lowCoverageFiles,
        },
        null,
        2,
      )}\n`,
    );

    const outputPath = coverageReportConfig.getOutputPath(scope);
    const lines = [
      `# LocalStudio ${coverageReportConfig.getScopeLabel(scope)} E2E Coverage`,
      '',
      `Monocart total byte coverage: ${getCoveragePercent(coverageResults).toFixed(2)}%.`,
      `Threshold: ${coverageReportConfig.threshold}%.`,
      '',
      '## Reports',
      '',
      `- HTML: \`${outputPath}/index.html\``,
      `- JSON: \`${outputPath}/coverage-report.json\``,
      `- Summary JSON: \`${outputPath}/coverage-summary.json\``,
      `- LCOV: \`${outputPath}/lcov.info\``,
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
    await writeFile(join(outputDir, 'coverage-ci-summary.md'), `${lines.join('\n')}\n`);
  },

  enforceThreshold(coverageResults: MCR.CoverageResults, scope: CoverageScope) {
    const coveragePercent = getCoveragePercent(coverageResults);
    if (coveragePercent < coverageReportConfig.threshold) {
      throw new Error(
        `${coverageReportConfig.getScopeLabel(scope)} E2E coverage threshold not met: ${coveragePercent.toFixed(
          2,
        )}% bytes < ${coverageReportConfig.threshold}%.`,
      );
    }
  },
};

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
