import MCR from 'monocart-coverage-reports';

import type { CoverageScope } from './coverage-report-config';

export const coverageSourceFilter = {
  isLocalScript(entry: MCR.V8CoverageEntry, scope: CoverageScope): boolean {
    if (!entry.url) return false;
    if (entry.url.startsWith('file:')) return isSourceFileInCoverageScope(entry.url, scope);
    let parsed: URL;
    try {
      parsed = new URL(entry.url);
    } catch {
      return isSourceFileInCoverageScope(entry.url, scope);
    }
    if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return false;
    return isSourceFileInCoverageScope(parsed.pathname, scope);
  },

  isReportableSourceFile(sourcePath: string, scope: CoverageScope): boolean {
    const normalized = this.normalizeSourcePath(sourcePath);
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

    return /\.(c|m)?(t|j)sx?$/.test(normalized) && isSourceInCoverageScope(normalized, scope);
  },

  normalizeSourcePath(
    sourcePath: string,
    info?: {
      distFile?: string;
    },
  ): string {
    const source = sourcePath.includes('/') ? sourcePath : (info?.distFile ?? sourcePath);
    let normalized = source.replaceAll('\\', '/').split('?')[0] ?? '';
    normalized = normalized.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1):\d+\//, '');
    normalized = normalized.replace(/^localhost-\d+\//, '');
    normalized = normalized.replace(/^@fs\//, '');
    const workspaceMarker = '/canva-webai-clone/';
    const workspaceIndex = normalized.indexOf(workspaceMarker);
    if (workspaceIndex >= 0) {
      normalized = normalized.slice(workspaceIndex + workspaceMarker.length);
    }
    normalized = normalized.replace(/^\/+/, '');

    if (normalized.startsWith('editor/src/')) return `apps/${normalized}`;
    if (normalized.startsWith('joystick/src/')) return `apps/${normalized}`;
    if (normalized.startsWith('landing/src/')) return `apps/${normalized}`;
    return normalized;
  },
};

function isSourceFileInCoverageScope(sourcePath: string, scope: CoverageScope) {
  const normalized = coverageSourceFilter.normalizeSourcePath(sourcePath);
  if (!normalized) return false;
  return (
    coverageSourceFilter.isReportableSourceFile(normalized, scope) &&
    isImplementedSourcePath(normalized)
  );
}

function isCoverageScaffoldSourceFile(normalized: string) {
  const scaffoldSourceFiles = new Set([
    'apps/editor/src/app/composition.ts',
    'apps/editor/src/app/routing/publicBasePath.ts',
    'apps/editor/src/domain/projects/sampleProject.ts',
    'apps/editor/src/services/fonts/googleFontsCatalog.ts',
    'apps/editor/src/services/model-setup/aiModelCatalog.ts',
    'apps/editor/src/ui/editor/animation/animationEffectCatalog.ts',
    'apps/editor/src/ui/editor/media/imagePromptOptions.ts',
    'apps/editor/src/ui/editor/media/localMediaImportConfig.ts',
    'apps/editor/src/ui/editor/text/textStyleOptions.ts',
    'packages/presenter-remote/src/peer-options.ts',
  ]);
  return scaffoldSourceFiles.has(normalized);
}

function isImplementedSourcePath(normalized: string) {
  const isImplementedSource =
    normalized.startsWith('apps/') ||
    normalized.startsWith('packages/') ||
    normalized.startsWith('src/') ||
    normalized.includes('/apps/') ||
    normalized.includes('/packages/') ||
    normalized.includes('/src/');
  return isImplementedSource;
}

function isSourceInCoverageScope(normalized: string, scope: CoverageScope) {
  if (scope === 'editor') {
    return normalized.startsWith('apps/editor/') || normalized.startsWith('packages/presenter-remote/');
  }
  if (scope === 'joystick') {
    return normalized.startsWith('apps/joystick/') || normalized.startsWith('packages/presenter-remote/');
  }
  return true;
}
