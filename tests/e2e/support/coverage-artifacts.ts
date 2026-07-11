import MCR from 'monocart-coverage-reports';

import { coverageBadgeArtifact } from './coverage-badge-artifact';
import { coverageCiSummaryArtifact } from './coverage-ci-summary-artifact';
import { coverageMetadataArtifact } from './coverage-metadata-artifact';
import type { CoverageScope } from './coverage-report-config';
import { coverageThreshold } from './coverage-threshold';

export const coverageArtifacts = {
  async writeBadge(coverageResults: MCR.CoverageResults, outputDir: string, scope: CoverageScope) {
    await coverageBadgeArtifact.write(coverageResults, outputDir, scope);
  },

  async writeMetadata(
    coverageResults: MCR.CoverageResults,
    coverageFiles: string[],
    outputDir: string,
    scope: CoverageScope,
  ) {
    await coverageMetadataArtifact.write(coverageResults, coverageFiles, outputDir, scope);
    await coverageCiSummaryArtifact.write(coverageResults, coverageFiles, outputDir, scope);
  },

  enforceThreshold(coverageResults: MCR.CoverageResults, scope: CoverageScope) {
    coverageThreshold.enforce(coverageResults, scope);
  },
};
