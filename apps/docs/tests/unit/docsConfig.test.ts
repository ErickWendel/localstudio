import { localStudioAppRoutes } from '@localstudio/app-routes';
import { describe, expect, it } from 'vitest';
import docsConfig from '../../.vitepress/config.js';

const githubIssuesUrl = 'https://github.com/ErickWendel/localstudio/issues/new/choose';

describe('docs VitePress config', () => {
  it('serves docs from the LocalStudio docs base path', () => {
    expect(docsConfig.title).toBe('LocalStudio.dev - Browser-native AI design studio');
    expect(docsConfig.base).toBe(localStudioAppRoutes.docs.base);
    expect(docsConfig.cleanUrls).toBe(true);
  });

  it('uses the landing favicon and footer copy', () => {
    expect(JSON.stringify(docsConfig.head)).toContain('/favicon.svg');
    expect(docsConfig.themeConfig?.footer?.message).toBe(
      'Built by Erick Wendel for browser-native AI workflows.',
    );
  });

  it('links Found a Bug to the editor GitHub issue chooser', () => {
    const sidebar = docsConfig.themeConfig?.sidebar;
    expect(JSON.stringify(sidebar)).toContain(githubIssuesUrl);
  });
});
