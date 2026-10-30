/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

// Builds the editor and popup pages. The extension's background worker and
// content script are bundled separately by scripts/build-ext.mjs, because
// content scripts cannot load ES module chunks.
// In `npm run dev`, serve the voice runtime files at /ort/ like the built app does.
const ortDev = {
  name: 'ort-dev',
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const m = req.url?.match(/\/ort\/(ort-wasm-simd-threaded\.jsep\.(?:mjs|wasm))$/)
      if (!m) return next()
      res.setHeader('Content-Type', m[1].endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
      res.end(readFileSync(resolve(import.meta.dirname, 'node_modules/@huggingface/transformers/dist', m[1])))
    })
  },
}

export default defineConfig({
  base: './',
  plugins: [react(), ortDev],
  worker: { format: 'es' },
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
