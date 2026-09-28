import { defineConfig } from 'vite';

// `base: './'` makes every asset path relative, which portals require
// (games are served from a sub-folder / iframe, never the domain root).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 2000,
  },
  server: { port: 5173, open: false },
});
