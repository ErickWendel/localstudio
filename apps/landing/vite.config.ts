import react from '@vitejs/plugin-react';
import { defineConfig, type Connect } from 'vite';
import { rewriteEditorPreviewRoute } from './src/routing/rewriteEditorPreviewRoute';
import { localNetworkOriginRoute } from '../../scripts/vite/localNetworkOriginRoute';
import { localPowerPointSampleRoute } from '../../scripts/vite/localPowerPointSampleRoute';
import { presenterRemoteSignalingRoute } from '../../scripts/vite/presenterRemoteSignalingRoute';

const siteBase = process.env.LOCALSTUDIO_BASE_PATH ?? '/';

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
  plugins: [
    localNetworkOriginRoute(),
    localPowerPointSampleRoute(),
    presenterRemoteSignalingRoute(),
    editorPreviewRouteFallback(),
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
