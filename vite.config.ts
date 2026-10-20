import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths, so the build also works from a subfolder or inside a desktop/mobile wrapper.
  base: './',
  build: {
    chunkSizeWarningLimit: 1600, // Phaser alone is ~1.2 MB minified
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
