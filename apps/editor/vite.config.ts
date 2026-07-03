import react from '@vitejs/plugin-react';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { defineConfig, type Connect } from 'vite';

const siteBase = process.env.LOCALSTUDIO_BASE_PATH ?? '/';
const editorBase = new URL('editor/', `https://localstudio.invalid${siteBase}`).pathname;
const pptxSamplePath =
  '/Users/erickwendel/Downloads/web-ai-beyond-chat-codecon-meetup-26052026.pptx';
const pptxSampleRoute = '/__localstudio/pptx-sample';

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

function pptxSampleImportRoute() {
  return {
    name: 'pptx-sample-import-route',
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use((req, res, next) => {
        void (async () => {
        if (!req.url?.startsWith(pptxSampleRoute)) {
          next();
          return;
        }

        const requestUrl = new URL(req.url, 'http://localstudio.invalid');
        if (requestUrl.pathname === `${pptxSampleRoute}/file`) {
          const fileStat = await stat(pptxSamplePath).catch(() => undefined);
          if (!fileStat?.isFile()) {
            res.statusCode = 404;
            res.end('Sample file not found.');
            return;
          }
          res.setHeader(
            'content-type',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          );
          createReadStream(pptxSamplePath).pipe(res);
          return;
        }

        next();
        })().catch(next);
      });
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
  if (id.includes('react-konva') || id.includes('/konva/')) {
    return 'canvas-workspace';
  }
  return undefined;
}

export default defineConfig({
  base: editorBase,
  plugins: [webMcpRouteAlias(), pptxSampleImportRoute(), react()],
  build: {
    chunkSizeWarningLimit: 1200,
    emptyOutDir: false,
    outDir: '../../dist/editor',
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
