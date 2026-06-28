import react from '@vitejs/plugin-react';
import { defineConfig, type Connect } from 'vite';

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

export default defineConfig({
  base: '/editor/',
  plugins: [webMcpRouteAlias(), react()],
  build: {
    emptyOutDir: false,
    outDir: '../../dist/editor',
  },
  test: {
    environment: 'jsdom',
    exclude: ['../../.worktrees/**', '../../dist/**', 'node_modules/**', 'tests/e2e/**'],
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: './tests/setup/testUtils.tsx',
  },
});
