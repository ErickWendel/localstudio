import MCR from 'monocart-coverage-reports';
import { mkdir, readFile } from 'node:fs/promises';

import { coverageArtifacts } from './coverage-artifacts';
import { coverageFiles } from './coverage-files';
import { isCoverageLocalScript } from './coverage-local-script-filter';
import { isCoverageReportableSourceFile } from './coverage-reportable-source-file';
import { coverageReportConfig } from './coverage-report-config';
import { normalizeCoverageSourcePath } from './coverage-source-path-normalizer';

interface TestCoverageFile {
  entries: MCR.V8CoverageEntry[];
  titlePath: string[];
}

export default async function reportPlaywrightCoverage() {
  if (process.env.E2E_COVERAGE === '0') return;
  if (process.env.E2E_COVERAGE_REPORT === '0') return;

  const coverageScope = coverageReportConfig.getScope();
  const coverageOutputDir = coverageReportConfig.getOutputDir(coverageScope);
  const browserCoverageFiles = await coverageFiles.find(coverageReportConfig.getInputDir());
  if (browserCoverageFiles.length === 0) {
    throw new Error('No browser coverage files were collected from Playwright.');
  }

  await mkdir(coverageOutputDir, { recursive: true });

  const coverageReport = MCR({
    name: `LocalStudio ${coverageReportConfig.getScopeLabel(coverageScope)} E2E Coverage`,
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
    entryFilter: (entry) => isCoverageLocalScript(entry, coverageScope),
    sourcePath: (sourcePath, info) => normalizeCoverageSourcePath(sourcePath, info),
    sourceFilter: (sourcePath) => isCoverageReportableSourceFile(sourcePath, coverageScope),
    watermarks: {
      bytes: [coverageReportConfig.threshold, 90],
      branches: [coverageReportConfig.threshold, 90],
      functions: [coverageReportConfig.threshold, 90],
      lines: [coverageReportConfig.threshold, 90],
      statements: [coverageReportConfig.threshold, 90],
    },
    onEnd: async (coverageResults) => {
      if (!coverageResults) {
        throw new Error('Monocart did not produce E2E coverage results.');
      }

      await coverageArtifacts.writeBadge(coverageResults, coverageOutputDir, coverageScope);
      await coverageArtifacts.writeMetadata(
        coverageResults,
        browserCoverageFiles,
        coverageOutputDir,
        coverageScope,
      );
      coverageArtifacts.enforceThreshold(coverageResults, coverageScope);
    },
  });

  for (const file of browserCoverageFiles) {
    const payload = JSON.parse(await readFile(file, 'utf8')) as TestCoverageFile;
    await coverageReport.add(payload.entries);
  }

  await coverageReport.generate();
}
