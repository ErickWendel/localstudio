import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/editor/',
  plugins: [react()],
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
