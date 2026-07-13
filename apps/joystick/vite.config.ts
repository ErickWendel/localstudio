import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const siteBase = process.env.LOCALSTUDIO_JOYSTICK_BASE_PATH ?? '/joystick/';

export default defineConfig({
  base: siteBase,
  plugins: [react()],
  build: {
    emptyOutDir: false,
    outDir: '../../dist/joystick',
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
