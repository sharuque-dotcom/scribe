import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
    // The 3D Crumbs chunk is big but loads lazily, after the page settles.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
        thanks: resolve(import.meta.dirname, 'thanks.html'),
        'compare-scribe': resolve(import.meta.dirname, 'compare/stepcrumb-vs-scribe.html'),
        'compare-tango': resolve(import.meta.dirname, 'compare/stepcrumb-vs-tango.html'),
        'compare-guidde': resolve(import.meta.dirname, 'compare/stepcrumb-vs-guidde.html'),
        'compare-loom': resolve(import.meta.dirname, 'compare/stepcrumb-vs-loom.html'),
      },
    },
  },
})
