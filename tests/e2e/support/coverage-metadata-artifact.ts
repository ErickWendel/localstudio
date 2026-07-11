import MCR from 'monocart-coverage-reports';
import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

import { coverageLowFiles } from './coverage-low-files';
import type { CoverageScope } from './coverage-report-config';
import { coverageReportConfig } from './coverage-report-config';

export const coverageMetadataArtifact = {
  async write(
    coverageResults: MCR.CoverageResults,
    coverageFiles: string[],
    outputDir: string,
    scope: CoverageScope,
  ) {
    const lowCoverageFiles = coverageLowFiles.get(coverageResults);
    await writeFile(
      join(outputDir, 'coverage-metadata.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          scope: coverageReportConfig.getScopeLabel(scope),
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
  },
};
