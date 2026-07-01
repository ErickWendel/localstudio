import react from '@vitejs/plugin-react';
import { defineConfig, type Connect } from 'vite';

const siteBase = process.env.LOCALSTUDIO_BASE_PATH ?? '/';

export function rewriteEditorPreviewRoute(req: { url?: string | undefined }) {
  if (!req.url) return;
  const [pathname, query = ''] = req.url.split('?');
  if (!pathname?.match(/^\/editor\/(s|embed)\/[^/]+\/?$/)) return;
  req.url = `/editor/${query ? `?${query}` : ''}`;
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

export default defineConfig({
  base: siteBase,
  plugins: [editorPreviewRouteFallback(), react()],
  build: {
    emptyOutDir: true,
    outDir: '../../dist',
  },
  test: {
    environment: 'jsdom',
    exclude: ['../../.worktrees/**', '../../dist/**', 'node_modules/**'],
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: './tests/setup/testUtils.tsx',
  },
});
