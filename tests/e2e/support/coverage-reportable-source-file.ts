import type { CoverageScope } from './coverage-report-config';
import { isCoverageScaffoldSourceFile } from './coverage-scaffold-source-file';
import { isCoverageSourceInScope } from './coverage-source-scope-filter';
import { normalizeCoverageSourcePath } from './coverage-source-path-normalizer';

export function isCoverageReportableSourceFile(sourcePath: string, scope: CoverageScope): boolean {
  const normalized = normalizeCoverageSourcePath(sourcePath);
  if (!normalized) return false;
  if (
    normalized.includes('/node_modules/') ||
    normalized.includes('/test-results/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/dist/') ||
    normalized.includes('/services/testing/') ||
    normalized.includes('/vendor/') ||
    normalized.includes('/@vite/') ||
    normalized.includes('/@react-refresh') ||
    normalized.includes('/coverage-report/') ||
    normalized.includes('/playwright-report/') ||
    normalized.includes('/virtual:') ||
    normalized.endsWith('/main.tsx') ||
    normalized.endsWith('/vite.config.ts') ||
    normalized.endsWith('.d.ts') ||
    normalized.endsWith('/vite-env.d.ts') ||
    isCoverageScaffoldSourceFile(normalized)
  ) {
    return false;
  }

  return /\.(c|m)?(t|j)sx?$/.test(normalized) && isCoverageSourceInScope(normalized, scope);
}
