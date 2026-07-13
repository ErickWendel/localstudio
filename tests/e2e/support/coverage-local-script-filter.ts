import type MCR from 'monocart-coverage-reports';

import type { CoverageScope } from './coverage-report-config';
import { isCoverageImplementedSourcePath } from './coverage-implemented-source-path';
import { isCoverageReportableSourceFile } from './coverage-reportable-source-file';
import { normalizeCoverageSourcePath } from './coverage-source-path-normalizer';

export function isCoverageLocalScript(entry: MCR.V8CoverageEntry, scope: CoverageScope): boolean {
  if (!entry.url) return false;
  if (entry.url.startsWith('file:')) return isSourceFileInCoverageScope(entry.url, scope);
  let parsed: URL;
  try {
    parsed = new URL(entry.url);
  } catch {
    return isSourceFileInCoverageScope(entry.url, scope);
  }
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return false;
  return isSourceFileInCoverageScope(parsed.pathname, scope) || isBuiltAssetInCoverageScope(parsed.pathname, scope);
}

function isSourceFileInCoverageScope(sourcePath: string, scope: CoverageScope) {
  const normalized = normalizeCoverageSourcePath(sourcePath);
  if (!normalized) return false;
  return isCoverageReportableSourceFile(normalized, scope) && isCoverageImplementedSourcePath(normalized);
}

function isBuiltAssetInCoverageScope(sourcePath: string, scope: CoverageScope) {
  const normalized = normalizeCoverageSourcePath(sourcePath);
  if (!normalized?.endsWith('.js')) return false;
  if (scope === 'editor') {
    return normalized.startsWith('editor/assets/') || normalized.startsWith('webmcp/assets/');
  }
  if (scope === 'joystick') return normalized.startsWith('joystick/assets/');
  if (scope === 'landing') return normalized.startsWith('assets/');
  return (
    normalized.startsWith('assets/') ||
    normalized.startsWith('editor/assets/') ||
    normalized.startsWith('joystick/assets/') ||
    normalized.startsWith('webmcp/assets/')
  );
}
