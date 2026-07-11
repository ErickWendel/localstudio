import MCR from 'monocart-coverage-reports';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CoverageScope } from './coverage-report-config';
import { coverageReportConfig } from './coverage-report-config';
import { coverageSummaryPercent } from './coverage-summary-percent';

export const coverageBadgeArtifact = {
  async write(coverageResults: MCR.CoverageResults, outputDir: string, scope: CoverageScope) {
    const coveragePercent = coverageSummaryPercent.bytes(coverageResults);
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
};

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
