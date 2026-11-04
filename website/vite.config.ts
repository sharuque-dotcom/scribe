import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
        terms: resolve(import.meta.dirname, 'terms.html'),
        thanks: resolve(import.meta.dirname, 'thanks.html'),
        'compare-scribe': resolve(import.meta.dirname, 'compare/stepcrumb-vs-scribe.html'),
      },
    },
  },
})
