import MCR from 'monocart-coverage-reports';

import type { CoverageScope } from './coverage-report-config';
import { coverageReportConfig } from './coverage-report-config';
import { coverageSummaryPercent } from './coverage-summary-percent';

export const coverageThreshold = {
  enforce(coverageResults: MCR.CoverageResults, scope: CoverageScope) {
    const coveragePercent = coverageSummaryPercent.bytes(coverageResults);
    if (coveragePercent < coverageReportConfig.threshold) {
      throw new Error(
        `${coverageReportConfig.getScopeLabel(scope)} E2E coverage threshold not met: ${coveragePercent.toFixed(
          2,
        )}% bytes < ${coverageReportConfig.threshold}%.`,
      );
    }
  },
};
