import { defineConfig } from 'vite';

export default defineConfig({
  // Custom domain (movieboyz.marcus-hill.com) → base is /
  base: '/',

  build: {
    rollupOptions: {
      // Suppress "use of eval / global variable" warnings for CDN UMD globals
      // (Chart, Tabulator, bootstrap) loaded via <script src> in index.html
      onwarn(warning, warn) {
        if (warning.code === 'MISSING_GLOBAL_NAME') return;
        warn(warning);
      },
    },
  },
});
