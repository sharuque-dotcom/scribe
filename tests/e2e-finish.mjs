// Finishing a capture must work on the first press, every time (QA Bug 1, F8).
// Run: npm run build && node tests/e2e-finish.mjs   (RUNS=10 by default)
// - Bar Finish while the page reacts to the mouse (hover highlights trigger
//   background screenshots, which used to hide the bar mid-press).
// - Bar Finish straight after typing: the typing step is kept, the editor opens.
// - Stop from the popup/service worker straight after typing: the typing step is kept.
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const RUNS = Number(process.env.RUNS ?? 10)
const root = resolve(import.meta.dirname, '..')
const server = createServer((req, res) => {
  let body
  try {
    body = readFileSync(join(root, 'tests/site', (req.url ?? '/').split('?')[0]))
  } catch {
    return res.writeHead(404).end()
  }
  res.writeHead(200, { 'content-type': 'text/html' }).end(body)
}).listen(4180)
const ext = join(root, 'dist')
const ctx = await chromium.launchPersistentContext('', { executablePath: process.env.CHROMIUM_PATH, headless: true, viewport: { width: 1280, height: 800 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] })
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
// Anonymous counts go to a stub, so tests never add to the real numbers.
await ctx.route('https://www.stepcrumb.com/api/count', (r) => r.fulfill({ status: 202, body: '{"ok":true}' }))
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (cond, msg) => {
  if (!cond) failures++
  console.log(cond ? 'ok  ' : 'FAIL', '-', msg)
}
const guideSteps = (id) =>
  sw.evaluate(async (id) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const g = await new Promise((r) => { const t = db.transaction('guides').objectStore('guides').get(id); t.onsuccess = () => r(t.result) })
    return g ? g.steps.map((s) => ({ title: s.title, action: s.action })) : null
  }, id)
const recording = async () => (await sw.evaluate(() => globalThis.scribe.getState())).recording
const editorTabs = () => ctx.pages().filter((p) => p.url().includes('editor.html'))
const closeEditors = async () => { for (const p of editorTabs()) await p.close() }
// Where the bar's buttons are (the bar is a closed shadow root; Finish sits left of "–").
const barBox = (page) =>
  page.evaluate(() => {
    const h = [...document.querySelectorAll('div')].find((d) => d.style.zIndex === '2147483647' && getComputedStyle(d).position === 'fixed')
    const r = h.getBoundingClientRect()
    return { right: r.right, cy: r.top + r.height / 2 }
  })
async function waitStopped() {
  for (let i = 0; i < 20; i++) {
    if (!(await recording())) return true
    await pause(250)
  }
  return false
}
async function waitEditor(n) {
  for (let i = 0; i < 20; i++) {
    if (editorTabs().length >= n) return true
    await pause(250)
  }
  return false
}

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())

  // 1. Hover page: move across the rows onto the bar, wait a varying moment, press Finish once.
  for (let i = 0; i < RUNS; i++) {
    await closeEditors()
    await page.bringToFront()
    await page.goto('http://localhost:4180/hover.html')
    await pause(300)
    const st = await sw.evaluate(() => globalThis.scribe.start('Hover finish'))
    await pause(900)
    await page.click('text=Contact 3')
    await pause(400)
    const bar = await barBox(page)
    await page.mouse.move(300, 300)
    await page.mouse.move(bar.right - 70, bar.cy, { steps: 25 })
    await pause([0, 150, 280, 330, 380, 450, 520, 600, 700, 900][i % 10])
    await page.mouse.down()
    await pause(60)
    await page.mouse.up()
    const stopped = await waitStopped()
    const opened = stopped && (await waitEditor(1))
    check(stopped && opened, `hover run ${i + 1}: one press on Finish stops the capture and opens the editor`)
    if (!stopped) await sw.evaluate(() => globalThis.scribe.stop(false))
    void st
  }

  // 2. Bar Finish straight after typing.
  for (let i = 0; i < RUNS; i++) {
    await closeEditors()
    await page.bringToFront()
    await page.goto('http://localhost:4180/login.html')
    await pause(300)
    const st = await sw.evaluate(() => globalThis.scribe.start('Typing finish'))
    await pause(900)
    await page.click('#email')
    await page.keyboard.type('sam@acme.io', { delay: 15 })
    const bar = await barBox(page)
    await page.mouse.move(bar.right - 70, bar.cy, { steps: 8 })
    await pause([0, 100, 250, 350, 450][i % 5])
    await page.mouse.down()
    await pause(60)
    await page.mouse.up()
    const stopped = await waitStopped()
    const opened = stopped && (await waitEditor(1))
    const steps = await guideSteps(st.guideId)
    check(stopped && opened && steps?.some((s) => s.action === 'type'), `typing run ${i + 1}: Finish after typing keeps the typing step and opens the editor` + (stopped && opened && steps?.some((s) => s.action === 'type') ? '' : ` [stopped=${stopped} editor=${opened} steps=${JSON.stringify(steps?.map((s) => s.action))}]`))
    if (!stopped) await sw.evaluate(() => globalThis.scribe.stop(false))
  }

  // 3. Stop from the popup (service worker) straight after typing.
  for (let i = 0; i < 3; i++) {
    await closeEditors()
    await page.bringToFront()
    await page.goto('http://localhost:4180/login.html')
    await pause(300)
    const st = await sw.evaluate(() => globalThis.scribe.start('Popup finish'))
    await pause(900)
    await page.click('#email')
    await page.keyboard.type('sam@acme.io', { delay: 15 })
    await sw.evaluate(() => globalThis.scribe.stop(false))
    const steps = await guideSteps(st.guideId)
    check(steps?.some((s) => s.action === 'type'), `popup run ${i + 1}: Finish from the popup after typing keeps the typing step`)
  }

  // 4. Keyboard: Tab to Finish is not possible in a closed shadow root from the page, so
  //    check Pause and Discard with one press each instead.
  await closeEditors()
  await page.bringToFront()
  await page.goto('http://localhost:4180/hover.html')
  await pause(300)
  const st = await sw.evaluate(() => globalThis.scribe.start('Pause and discard'))
  await pause(900)
  let bar = await barBox(page)
  // Pause is the first button: about 215 px left of the bar's right edge.
  const pauseX = await page.evaluate(() => 0)
  void pauseX
  await page.mouse.click(bar.right - 215, bar.cy)
  await pause(500)
  check((await sw.evaluate(() => globalThis.scribe.getState())).paused === true, 'one press on Pause pauses')
  bar = await barBox(page)
  await page.mouse.click(bar.right - 230, bar.cy)
  await pause(500)
  check((await sw.evaluate(() => globalThis.scribe.getState())).paused === false, 'one press on Resume resumes')
  bar = await barBox(page)
  await page.mouse.click(bar.right - 135, bar.cy)
  await pause(200)
  await page.mouse.click(bar.right - 135, bar.cy)
  await pause(800)
  check(!(await recording()) && (await guideSteps(st.guideId)) === null, 'Discard, then "Delete it?", deletes the capture')

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll finish checks passed.')
  process.exitCode = failures ? 1 : 0
} finally {
  await ctx.close()
  server.close()
}
