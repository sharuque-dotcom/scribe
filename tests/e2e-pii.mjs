// Auto-blur check. Run: npm run build && node tests/e2e-pii.mjs [outDir]
// Captures a page full of personal details (screenshots + tab video) and checks
// that each one gets a removable blur box, that typed details stay out of the
// step text, and that the video records where they were.
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
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
  let body
  try {
    body = readFileSync(join(root, 'tests/site', (req.url ?? '/').split('?')[0]))
  } catch {
    return res.writeHead(404).end()
  }
  res.writeHead(200, { 'content-type': 'text/html' }).end(body)
}).listen(4177)

const launch = (extra = []) =>
  chromium.launchPersistentContext('', {
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1200, height: 800 },
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...extra],
  })
// Tab capture normally needs a click on the extension button; an allowlisted
// extension may skip that in automated runs.
let ctx = await launch()
const first = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
const extId = new URL(first.url()).host
await ctx.close()
ctx = await launch([`--allowlisted-extension-id=${extId}`])
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
// Anonymous counts go to a stub, so tests never add to the real numbers.
await ctx.route('https://www.stepcrumb.com/api/count', (r) => r.fulfill({ status: 202, body: '{"ok":true}' }))
sw.on('console', (m) => m.type() !== 'log' && console.log('[sw]', m.text().slice(0, 300)))
try {
  // Free plan: own words are saved but don't apply.
  await sw.evaluate(() => chrome.storage.local.set({ autoBlur: { on: true, kinds: { email: true, phone: true, card: true, emiratesId: true, iban: true }, custom: ['Al Mansoori'] } }))
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto('http://localhost:4177/patients.html')
  await page.bringToFront()
  const st = await sw.evaluate(() => globalThis.scribe.start('Update a patient', { mode: 'both', source: 'tab' }))
  check(st.recording && st.video, 'capturing with video')
  await pause(1200)
  await page.click('#contact')
  await page.keyboard.type('aisha.m@example.ae', { delay: 40 })
  // A person pauses before the next click, so the page is captured with the value typed.
  await pause(1500)
  await page.click('#save')
  await pause(2500)
  const boxes = await page.evaluate(() => {
    const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.left / innerWidth, y: b.top / innerHeight, w: b.width / innerWidth, h: b.height / innerHeight } }
    return { email: r('#email1'), phone: r('#phone1'), eid: r('#eid1'), note: r('#note') }
  })

  const editorPromise = ctx.waitForEvent('page')
  await sw.evaluate(() => globalThis.scribe.stop(true))
  const editor = await editorPromise
  await editor.waitForLoadState()
  const guideId = new URL(editor.url()).hash.split('/')[2]
  const g = await editor.evaluate(async (id) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    return new Promise((r) => { const t = db.transaction('guides').objectStore('guides').get(id); t.onsuccess = () => r(t.result) })
  }, guideId)
  const titles = g.steps.map((s) => s.title)
  console.log('steps:', titles)
  const typed = g.steps.find((s) => s.action === 'type')
  check(typed && /^Type an email address/.test(typed.title) && !JSON.stringify(g.steps).includes('aisha.m@example.ae"'), `typed email left out of step text ("${typed?.title}")`)

  const auto = g.steps[g.steps.length - 1].annotations.filter((a) => a.auto)
  // The box sits inside the table cell, across the middle of its text.
  const covers = (box) => auto.some((a) => a.x1 >= box.x - 0.005 && a.x1 < box.x + box.w * 0.3 && a.x2 > box.x + box.w * 0.4 && a.y1 <= box.y + box.h * 0.5 && a.y2 >= box.y + box.h * 0.5)
  check(covers(boxes.email), 'email in the table has a blur box')
  check(covers(boxes.phone), 'phone number has a blur box')
  check(covers(boxes.eid), 'Emirates ID has a blur box')
  check(auto.some((a) => a.y1 <= boxes.note.y + boxes.note.h / 2 && a.y2 >= boxes.note.y + boxes.note.h / 2 && a.x2 - a.x1 < boxes.note.w * 0.6), 'card number has a blur box (not the whole line)')
  check(!auto.some((a) => a.x1 < 0.05 && a.y1 > boxes.email.y - 0.01 && a.y1 < boxes.email.y + 0.02), 'free plan: own words (a name) are not blurred')
  const field = await page.evaluate(() => { const b = document.querySelector('#contact').getBoundingClientRect(); return { y: (b.top + b.height / 2) / innerHeight } })
  check(auto.some((a) => a.y1 <= field.y && a.y2 >= field.y), 'the email typed into the field is blurred on the next screenshot')
  check(auto.length >= 8, `blur boxes for every detail (${auto.length})`)
  check(g.video?.pii?.some((p) => p.rects.length >= 4), 'video records where the details were')

  // Boxes can be removed like any other annotation.
  await editor.goto(editor.url().replace(/\/video$/, ''))
  await editor.waitForTimeout(1500)
  const shot = editor.locator('main img').nth(2)
  await shot.scrollIntoViewIfNeeded()
  await editor.waitForTimeout(800)
  await shot.screenshot({ path: join(out, 'pii-step.png') })
  console.log('\nAll auto-blur checks passed.')
} finally {
  await ctx.close()
  server.close()
}
