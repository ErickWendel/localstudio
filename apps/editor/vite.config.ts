import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';
import { localNetworkOriginRoute } from '../../scripts/vite/localNetworkOriginRoute';
import { localPowerPointSampleRoute } from '../../scripts/vite/localPowerPointSampleRoute';

const siteBase = process.env.LOCALSTUDIO_BASE_PATH ?? '/';
const editorBase = new URL('editor/', `https://localstudio.invalid${siteBase}`).pathname;

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

function rewriteWebMcpRoute(req: Connect.IncomingMessage) {
  if (!req.url) return;
  if (req.url === '/webmcp') {
    req.url = '/editor/';
    return;
  }
  if (req.url.startsWith('/webmcp?')) {
    req.url = `/editor/${req.url.slice('/webmcp'.length)}`;
  }
}

function webMcpRouteAlias() {
  return {
    name: 'webmcp-route-alias',
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use((req, _res, next) => {
        rewriteWebMcpRoute(req);
        next();
      });
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use((req, _res, next) => {
        rewriteWebMcpRoute(req);
        next();
      });
    },
  };
}

function inlineStylesheetLinks(): Plugin {
  return {
    name: 'inline-editor-stylesheet-links',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const cssAssets = Object.entries(context.bundle ?? {}).flatMap(([bundleKey, asset]) => {
          const cssAsset = getCssAsset(asset);
          return cssAsset ? [{ ...cssAsset, bundleKey }] : [];
        });

        const htmlWithInlineStyles = cssAssets.reduce((nextHtml, asset) => {
          const escapedFileName = asset.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const stylesheetLinkPattern = new RegExp(
            `<link rel="stylesheet"([^>]*?)href="([^"]*${escapedFileName})"([^>]*?)>`,
          );

          if (!stylesheetLinkPattern.test(nextHtml)) {
            return nextHtml;
          }

          delete context.bundle?.[asset.bundleKey];

          return nextHtml.replace(
            stylesheetLinkPattern,
            `<style data-inline-stylesheet="${asset.fileName}">\n${asset.source}\n</style>`,
          );
        }, html);

        return htmlWithInlineStyles.replace(
          /\n\s*<link rel="modulepreload" crossorigin href="[^"]*\/assets\/canvas-workspace-[^"]+\.js">/g,
          '',
        );
      },
    },
  };
}

function editorManualChunks(id: string) {
  if (id.includes('@huggingface/transformers') || id.includes('onnxruntime-web')) {
    return 'ml-transformers';
  }
  if (id.includes('bonsai-image-webgpu-runtime')) {
    return 'ml-bonsai-image';
  }
  return undefined;
}

export default defineConfig({
  base: editorBase,
  plugins: [
    localNetworkOriginRoute(),
    localPowerPointSampleRoute(),
    webMcpRouteAlias(),
    inlineStylesheetLinks(),
    react(),
  ],
  optimizeDeps: {
    include: ['@giphy/js-fetch-api', 'unsplash-js'],
  },
  build: {
    chunkSizeWarningLimit: 1200,
    emptyOutDir: false,
    outDir: '../../dist/editor',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: editorManualChunks,
      },
    },
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        manualChunks: editorManualChunks,
      },
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['../../.worktrees/**', '../../dist/**', 'node_modules/**', 'tests/e2e/**'],
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: './tests/setup/testUtils.tsx',
  },
});
