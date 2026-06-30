import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const siteBase = process.env.LOCALSTUDIO_BASE_PATH ?? '/';

export default defineConfig({
  base: siteBase,
  plugins: [react()],
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
