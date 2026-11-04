// Checks for the 1.0.1 QA findings. Run: npm run build && node tests/e2e-qa-fixes.mjs
// - Bug 1: clicking Finish on the capture bar right after typing works first time,
//   and the typing step is kept.
// - Bug 2: choosing from a dropdown is captured as a step.
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const server = createServer((req, res) => {
  let body
  try {
    body = readFileSync(join(root, 'tests/site', (req.url ?? '/').split('?')[0]))
  } catch {
    return res.writeHead(404).end()
  }
  res.writeHead(200, { 'content-type': 'text/html' }).end(body)
}).listen(4179)
const ext = join(root, 'dist')
const ctx = await chromium.launchPersistentContext('', { executablePath: process.env.CHROMIUM_PATH, headless: true, viewport: { width: 1280, height: 800 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] })
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
// Anonymous counts go to a stub, so tests never add to the real numbers.
await ctx.route('https://www.stepcrumb.com/api/count', (r) => r.fulfill({ status: 202, body: '{"ok":true}' }))
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (cond, msg) => {
  if (!cond) throw new Error('FAILED: ' + msg)
  console.log('ok -', msg)
}
const guideSteps = (id) =>
  sw.evaluate(async (id) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const g = await new Promise((r) => { const t = db.transaction('guides').objectStore('guides').get(id); t.onsuccess = () => r(t.result) })
    return g.steps.map((s) => ({ title: s.title, action: s.action }))
  }, id)

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  // ---- Bug 2: dropdown ----
  let st, steps
  if (!process.env.ONLY_BAR) {
  await page.goto('http://localhost:4179/dashboard.html')
  await pause(400)
  st = await sw.evaluate(() => globalThis.scribe.start('Dropdown test'))
  await pause(800)
  await page.click('#new')
  await pause(600)
  await page.click('#ptype')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await pause(800)
  await page.selectOption('#ptype', { index: 2 })
  await pause(800)
  await sw.evaluate(() => globalThis.scribe.stop(false))
  steps = await guideSteps(st.guideId)
  console.log('steps:', steps.map((s) => s.title))
  check(steps.filter((s) => s.action === 'select').length >= 1, 'choosing from a dropdown is captured as a step')
  }

  // ---- Bug 1: Finish right after typing ----
  await page.goto('http://localhost:4179/login.html')
  await pause(400)
  st = await sw.evaluate(() => globalThis.scribe.start('Bar test'))
  await pause(1200)
  await page.click('#email')
  await page.keyboard.type('sam@acme.io', { delay: 20 })
  // The bar is a fixed element at the bottom right; Finish is just left of its "–" button.
  const bar = await page.evaluate(() => {
    const h = [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '2147483647' && d.shadowRoot === null && getComputedStyle(d).position === 'fixed')
    const r = h.getBoundingClientRect()
    return { right: r.right, cy: r.top + r.height / 2 }
  })
  await page.mouse.click(bar.right - 70, bar.cy)
  for (let i = 0; i < 24; i++) { await pause(500); const r = await sw.evaluate(() => globalThis.scribe.getState()); if (!r.recording) break }
  const after = await sw.evaluate(() => globalThis.scribe.getState())
  check(!after.recording, 'one click on Finish, straight after typing, finishes the capture')
  steps = await guideSteps(st.guideId)
  console.log('steps:', steps.map((s) => s.title))
  check(steps.some((s) => s.action === 'type'), 'the typing step is kept')
  console.log('\nAll QA-fix checks passed.')
} finally {
  await ctx.close()
  server.close()
}
