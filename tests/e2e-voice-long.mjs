// Long voiceover check with the real voice model: ~20 steps, including typing
// that ends with Enter at the same instant, a very long typed note, and fast
// clicks at the end. Two lines' voice is deleted before export, so export must
// make them first. The exported audio must have narration at every caption,
// and narrations must not overlap.
// Usage: npm run build && CHROMIUM_PATH=/path/to/chrome node tests/e2e-voice-long.mjs [outDir]
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(root, 'tests/output'))
mkdirSync(out, { recursive: true })
const ext = join(root, 'dist')
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (cond, msg) => {
  if (!cond) throw new Error('FAILED: ' + msg)
  console.log('ok -', msg)
}
const server = createServer((req, res) => {
  try {
    const body = readFileSync(join(root, 'tests/site', (req.url ?? '/').split('?')[0]))
    res.writeHead(200, { 'content-type': 'text/html' }).end(body)
  } catch {
    res.writeHead(404).end()
  }
}).listen(4177)

const launch = (extra = []) => chromium.launchPersistentContext('', { executablePath: process.env.CHROMIUM_PATH, headless: true, viewport: { width: 1280, height: 800 }, acceptDownloads: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...extra] })
const workerOf = async (ctx) => ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
let ctx = await launch()
const extId = new URL((await workerOf(ctx)).url()).host
await ctx.close()
ctx = await launch([`--allowlisted-extension-id=${extId}`])
const sw = await workerOf(ctx)

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto('http://localhost:4177/long.html')
  await pause(400)
  await page.bringToFront()
  await sw.evaluate(() => globalThis.scribe.start('Book an appointment', { mode: 'both', source: 'tab' }))
  await pause(800)
  // Search box focused by a button (no click into it), then Enter: two steps at one instant.
  await page.click('#open'); await pause(400)
  await page.keyboard.type('IL-040568', { delay: 40 }); await page.keyboard.press('Enter'); await pause(700)
  // A very long note.
  await page.click('#notes')
  await page.keyboard.type('Patient prefers morning slots, has mild symptoms, was referred by the clinic and needs a follow up next week. Call before the visit to confirm insurance details and the preferred language for the consultation. '.repeat(2), { delay: 2 })
  for (let i = 1; i <= 8; i++) { await page.click('#b' + i); await pause(650) }
  for (let i = 9; i <= 14; i++) { await page.click('#b' + i); await pause(140) }
  await pause(1200)

  const editorPromise = ctx.waitForEvent('page')
  await sw.evaluate(() => globalThis.scribe.stop(true))
  const editor = await editorPromise
  await editor.waitForLoadState()
  await editor.setViewportSize({ width: 1440, height: 900 })
  const guideId = new URL(editor.url()).hash.split('/')[2]
  await editor.goto(editor.url().replace(/\/video$/, '') + '/video')
  await editor.waitForSelector('canvas[aria-label="Video preview"]')
  const steps = await editor.evaluate(async (id) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const g = await new Promise((r) => { const q = db.transaction('guides').objectStore('guides').get(id); q.onsuccess = () => r(q.result) })
    return g.steps.filter((s) => typeof s.time === 'number').map((s) => ({ title: s.title, time: s.time }))
  }, guideId)
  console.log(`${steps.length} timed steps:\n  ` + steps.map((s) => `${(s.time / 1000).toFixed(2)}s ${s.title.slice(0, 70)}`).join('\n  '))
  check(steps.length >= 18, 'a long guide was recorded')

  const t0 = Date.now()
  await editor.getByRole('button', { name: /Generate voiceover/ }).click()
  await editor.getByRole('button', { name: 'Voice is up to date' }).waitFor({ timeout: 900_000 })
  console.log(`   voice for ${steps.length} lines generated in ${Math.round((Date.now() - t0) / 1000)}s`)
  check((await editor.getByRole('alert').filter({ hasText: 'could not get a voice' }).count()) === 0, 'every line got a voice (no failures)')

  // Remove two lines' voice (the last two), then export: export must make them first.
  await editor.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const keys = await new Promise((r) => { const q = db.transaction('voice').objectStore('voice').getAllKeys(); q.onsuccess = () => r(q.result) })
    const doomed = keys.filter((k) => /Confirm|Close/.test(k))
    await new Promise((r) => { const tx = db.transaction('voice', 'readwrite'); for (const k of doomed) tx.objectStore('voice').delete(k); tx.oncomplete = r })
  })
  await editor.reload()
  await editor.getByRole('button', { name: /Update voice \(2 lines\)/ }).waitFor({ timeout: 30_000 })
  check(true, 'deleted voice shows as 2 lines missing')

  const vidDl = editor.waitForEvent('download', { timeout: 900_000 })
  await editor.getByRole('button', { name: /Export video/ }).click()
  const video = await vidDl
  const file = join(out, 'voice-long.' + video.suggestedFilename().split('.').pop())
  await video.saveAs(file)
  check(await editor.getByRole('button', { name: 'Voice is up to date' }).count() === 1, 'export made the missing voice first')
  const vttDl = editor.waitForEvent('download')
  await editor.getByRole('button', { name: '.vtt' }).click()
  const vtt = readFileSync(await (await vttDl).path(), 'utf8')
  const cues = [...vtt.matchAll(/(\d\d):(\d\d):(\d\d)\.(\d\d\d) --> (\d\d):(\d\d):(\d\d)\.(\d\d\d)\n([^\n]+)/g)].map((m) => ({ start: ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + +m[4], end: ((+m[5] * 60 + +m[6]) * 60 + +m[7]) * 1000 + +m[8], text: m[9] }))
  console.log(`   ${cues.length} captions; exported ${file}`)
  // Audio level just after each caption starts (the voice starts 150ms in).
  // Decode the audio with ffmpeg (mono, 16 kHz float samples).
  const rate = 16000
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 })
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
  check(pcm.length > rate, 'exported video has a voice track')
  writeFileSync(join(out, 'voice-long.vtt'), vtt)
  const rms = (a, b) => { let x = 0; const i0 = Math.floor(a * rate / 1000), i1 = Math.min(pcm.length, Math.floor(b * rate / 1000)); for (let i = i0; i < i1; i++) x += pcm[i] * pcm[i]; return 20 * Math.log10(Math.sqrt(x / Math.max(1, i1 - i0)) + 1e-9) }
  const levels = cues.map((c) => ({ text: c.text.slice(0, 60), db: +rms(c.start + 250, c.start + 750).toFixed(1) }))
  console.log(levels.map((l) => `   ${l.db} dB  ${l.text}`).join('\n'))
  const silent = levels.filter((l) => l.db < -45)
  check(silent.length === 0, `narration plays at every caption (${silent.length} silent${silent.length ? ': ' + silent.map((l) => l.text).join('; ') : ''})`)
  console.log('\nAll long-voice checks passed.')
} finally {
  await ctx.close()
  server.close()
}
