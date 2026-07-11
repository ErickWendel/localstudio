import MCR from 'monocart-coverage-reports';

export type LowCoverageSourceFile = {
  bytes: number | '';
  lines: number | '';
  sourcePath: string;
};

export const coverageLowFiles = {
  get(coverageResults: MCR.CoverageResults): LowCoverageSourceFile[] {
    return coverageResults.files
      .map((file) => ({
        bytes: file.summary.bytes?.pct ?? '',
        lines: file.summary.lines.pct,
        sourcePath: file.sourcePath,
      }))
      .filter((file) => typeof file.bytes === 'number' || typeof file.lines === 'number')
      .sort((a, b) => getSortPercent(a.bytes, a.lines) - getSortPercent(b.bytes, b.lines))
      .slice(0, 20);
  },
};

function getSortPercent(bytes: number | '', lines: number | '') {
  if (typeof bytes === 'number') return bytes;
  if (typeof lines === 'number') return lines;
  return Number.POSITIVE_INFINITY;
}
