import { join, relative } from 'node:path';
import process from 'node:process';

export type CoverageScope = 'all' | 'editor' | 'joystick' | 'landing';

export const coverageReportConfig = {
  get threshold(): number {
    const threshold = Number.parseFloat(process.env.E2E_COVERAGE_THRESHOLD ?? '80');
    return Number.isFinite(threshold) ? threshold : 80;
  },

  getInputDir(): string {
    return process.env.E2E_COVERAGE_INPUT_DIR ?? join(process.cwd(), 'test-results');
  },

  getOutputDir(scope: CoverageScope): string {
    if (process.env.E2E_COVERAGE_OUTPUT_DIR) return process.env.E2E_COVERAGE_OUTPUT_DIR;
    return scope === 'all'
      ? join(process.cwd(), 'coverage-report')
      : join(process.cwd(), 'coverage-report', scope);
  },

  getOutputPath(scope: CoverageScope): string {
    const outputPath = relative(process.cwd(), this.getOutputDir(scope));
    return outputPath || 'coverage-report';
  },

  getScope(): CoverageScope {
    const scope = process.env.E2E_COVERAGE_SCOPE;
    if (scope === 'editor' || scope === 'joystick' || scope === 'landing') return scope;
    return 'all';
  },

  getScopeLabel(scope: CoverageScope): string {
    if (scope === 'editor') return 'Editor';
    if (scope === 'joystick') return 'Joystick';
    if (scope === 'landing') return 'Landing';
    return 'Aggregate';
  },
};
