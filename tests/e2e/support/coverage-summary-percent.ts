import MCR from 'monocart-coverage-reports';

export const coverageSummaryPercent = {
  bytes(coverageResults: MCR.CoverageResults) {
    const pct = coverageResults.summary.bytes?.pct;
    return typeof pct === 'number' ? pct : 0;
  },
};
