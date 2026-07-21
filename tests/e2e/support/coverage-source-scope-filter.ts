import type { CoverageScope } from './coverage-report-config';

export function isCoverageSourceInScope(normalized: string, scope: CoverageScope) {
  if (scope === 'editor') {
    return normalized.startsWith('apps/editor/') || normalized.startsWith('packages/presenter-remote/');
  }
  if (scope === 'joystick') {
    return normalized.startsWith('apps/joystick/');
  }
  if (scope === 'landing') {
    return normalized.startsWith('apps/landing/') || normalized.startsWith('packages/brand/');
  }
  return true;
}
