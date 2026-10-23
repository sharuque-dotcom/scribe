/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Builds the editor and popup pages. The extension's background worker and
// content script are bundled separately by scripts/build-ext.mjs, because
// content scripts cannot load ES module chunks.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        editor: resolve(import.meta.dirname, 'editor.html'),
        popup: resolve(import.meta.dirname, 'popup.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
