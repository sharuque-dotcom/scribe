// Bundles the extension's service worker and content script into dist/
// and copies the manifest. Run after `vite build`.
import { build } from 'esbuild'
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'

const common = { bundle: true, minify: true, target: 'chrome110', logLevel: 'info' }

await build({ ...common, entryPoints: ['src/extension/background.ts'], outfile: 'dist/background.js', format: 'esm' })
await build({ ...common, entryPoints: ['src/extension/content.ts'], outfile: 'dist/content.js', format: 'iife' })
await build({ ...common, entryPoints: ['src/extension/offscreen.ts'], outfile: 'dist/offscreen.js', format: 'iife' })
// The free voice runs on ONNX Runtime in WebAssembly. Its files ship inside the
// extension, because extensions may not load code from the internet.
mkdirSync('dist/ort', { recursive: true })
for (const f of ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
  cpSync(`node_modules/@huggingface/transformers/dist/${f}`, `dist/ort/${f}`)
}
cpSync('public/manifest.json', 'dist/manifest.json')
// Vite also emits its own copy of the WebAssembly file. The app always loads the
// one in dist/ort/ (set in the voice worker), so drop the duplicate (~21 MB).
for (const f of readdirSync('dist/assets')) if (/^ort-wasm.*\.wasm$/.test(f)) rmSync(`dist/assets/${f}`)
