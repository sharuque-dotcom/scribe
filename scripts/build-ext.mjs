// Bundles the extension's service worker and content script into dist/
// and copies the manifest. Run after `vite build`.
import { build } from 'esbuild'
import { cpSync } from 'node:fs'

const common = { bundle: true, minify: true, target: 'chrome110', logLevel: 'info' }

await build({ ...common, entryPoints: ['src/extension/background.ts'], outfile: 'dist/background.js', format: 'esm' })
await build({ ...common, entryPoints: ['src/extension/content.ts'], outfile: 'dist/content.js', format: 'iife' })
cpSync('public/manifest.json', 'dist/manifest.json')
