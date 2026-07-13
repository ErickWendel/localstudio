import { isCoverageReportableSourceFile } from './coverage-reportable-source-file';

export const browserCoveragePath = {
  fromUrl(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) return '';
      return parsed.pathname.replace(/^\/@fs\//, '/').split('?')[0] ?? '';
    } catch {
      return url.replace(/^@fs\//, '').split('?')[0] ?? '';
    }
  },

  isLocalHttpUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol.startsWith('http') &&
        ['localhost', '127.0.0.1'].includes(parsed.hostname)
      );
    } catch {
      return false;
    }
  },

  shouldCollect(browserName: string): boolean {
    return browserName === 'chromium' && process.env.E2E_COVERAGE !== '0';
  },

  shouldFetchSource(url: string): boolean {
    const path = this.fromUrl(url);
    return path ? isCoverageReportableSourceFile(path, 'all') || isBuiltAssetScriptPath(path) : false;
  },
};

function isBuiltAssetScriptPath(path: string): boolean {
  return (
    path.endsWith('.js') &&
    (path.startsWith('assets/') ||
      path.startsWith('editor/assets/') ||
      path.startsWith('joystick/assets/') ||
      path.startsWith('webmcp/assets/'))
  );
}
