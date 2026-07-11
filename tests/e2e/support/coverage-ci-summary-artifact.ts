import MCR from 'monocart-coverage-reports';
import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

import { coverageLowFiles } from './coverage-low-files';
import { coveragePercentFormat } from './coverage-percent-format';
import type { CoverageScope } from './coverage-report-config';
import { coverageReportConfig } from './coverage-report-config';
import { coverageSummaryPercent } from './coverage-summary-percent';

export const coverageCiSummaryArtifact = {
  async write(
    coverageResults: MCR.CoverageResults,
    coverageFiles: string[],
    outputDir: string,
    scope: CoverageScope,
  ) {
    const outputPath = coverageReportConfig.getOutputPath(scope);
    const lines = [
      `# LocalStudio ${coverageReportConfig.getScopeLabel(scope)} E2E Coverage`,
      '',
      `Monocart total byte coverage: ${coverageSummaryPercent.bytes(coverageResults).toFixed(2)}%.`,
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
      ...coverageLowFiles.get(coverageResults).map(
        (file) =>
          `| \`${file.sourcePath}\` | ${coveragePercentFormat.format(
            file.bytes,
          )} | ${coveragePercentFormat.format(file.lines)} |`,
      ),
      '',
      '## Raw Playwright Coverage Files',
      '',
      ...coverageFiles.map((file) => `- \`${relative(process.cwd(), file)}\``),
      '',
    ];
    await writeFile(join(outputDir, 'coverage-ci-summary.md'), `${lines.join('\n')}\n`);
  },
};
