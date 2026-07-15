import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';
import { rewriteEditorPreviewRoute } from './src/routing/rewriteEditorPreviewRoute';
import { localNetworkOriginRoute } from '../../scripts/vite/localNetworkOriginRoute';
import { localPowerPointSampleRoute } from '../../scripts/vite/localPowerPointSampleRoute';
import { presenterRemoteSignalingRoute } from '../../scripts/vite/presenterRemoteSignalingRoute';

const siteBase = process.env.LOCALSTUDIO_BASE_PATH ?? '/';

function getCssAsset(asset: unknown) {
  if (!asset || typeof asset !== 'object') {
    return null;
  }

  const candidate = asset as { fileName?: unknown; source?: unknown; type?: unknown };
  if (candidate.type !== 'asset' || typeof candidate.fileName !== 'string') {
    return null;
  }

  if (!candidate.fileName.endsWith('.css') || typeof candidate.source !== 'string') {
    return null;
  }

  return {
    fileName: candidate.fileName,
    source: candidate.source,
  };
}

function editorPreviewRouteFallback() {
  return {
    name: 'editor-preview-route-fallback',
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use((req, _res, next) => {
        rewriteEditorPreviewRoute(req);
        next();
      });
    },
  };
}

function inlineStylesheetLinks(): Plugin {
  return {
    name: 'inline-stylesheet-links',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const cssAssets = Object.entries(context.bundle ?? {}).flatMap(([bundleKey, asset]) => {
          const cssAsset = getCssAsset(asset);
          return cssAsset ? [{ ...cssAsset, bundleKey }] : [];
        });

        return cssAssets.reduce((nextHtml, asset) => {
          const escapedFileName = asset.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const stylesheetLinkPattern = new RegExp(
            `<link rel="stylesheet"([^>]*?)href="([^"]*${escapedFileName})"([^>]*?)>`,
            'g',
          );

          delete context.bundle?.[asset.bundleKey];

          return nextHtml.replace(
            stylesheetLinkPattern,
            `<style data-inline-stylesheet="${asset.fileName}">\n${asset.source}\n</style>`,
          );
        }, html);
      },
    },
  };
}

export default defineConfig({
  base: siteBase,
  plugins: [
    localNetworkOriginRoute(),
    localPowerPointSampleRoute(),
    presenterRemoteSignalingRoute(),
    editorPreviewRouteFallback(),
    inlineStylesheetLinks(),
    react(),
  ],
  build: {
    emptyOutDir: true,
    outDir: '../../dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    exclude: ['../../.worktrees/**', '../../dist/**', 'node_modules/**'],
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: './tests/setup/testUtils.tsx',
  },
});
