// Window / entire-screen recording check. Needs a display (run under xvfb-run):
//   npm run build && CHROMIUM_PATH=/path/to/chrome xvfb-run -a -s "-screen 0 1600x1000x24" node tests/e2e-screen.mjs [outDir] [screen|window] [video]
// Records the test site with the chosen source, then checks the video size and
// that each click's position in the video matches where the pointer really was.
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(root, 'tests/output'))
const source = ['window', 'tab'].includes(process.argv[3]) ? process.argv[3] : 'screen'
// 'video' = video only (no screenshots); otherwise screenshots + video.
const mode = process.argv[4] === 'video' ? 'video' : 'both'
mkdirSync(out, { recursive: true })
const ext = join(root, 'dist')
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (cond, msg) => {
  if (!cond) throw new Error('FAILED: ' + msg)
  console.log('ok -', msg)
}

const server = createServer((req, res) => {
  const file = join(root, 'tests/site', (req.url ?? '/').split('?')[0].replace(/^\/$/, '/login.html'))
  let body
  try {
    body = readFileSync(file)
  } catch {
    return res.writeHead(404).end()
  }
  res.writeHead(200, { 'content-type': 'text/html' }).end(body)
}).listen(4175)

// The capture picker is answered automatically by Chromium's test switch.
const pickName = source === 'screen' ? 'Entire screen' : process.env.PICK ?? (source === 'tab' ? 'Sign in · Projectly' : 'Sign in · Projectly - Chromium')
const ctx = await chromium.launchPersistentContext('', {
  executablePath: process.env.CHROMIUM_PATH,
  headless: false,
  viewport: null,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--window-position=120,60', '--window-size=1200,820', `--auto-select-desktop-capture-source=${pickName}`],
})
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))

// Real mouse input on the virtual display (xdotool), so events carry true
// screen positions. We find where the page is on screen by moving the real
// pointer to a known spot, then click elements at their true screen positions.
const xdo = (args) => execSync(`xdotool ${args}`)
let origin = null
async function calibrate(page) {
  xdo('mousemove 700 500')
  await pause(150)
  xdo('mousemove 704 503')
  await pause(250)
  const m = await page.evaluate(() => window.__move)
  origin = { x: 704 - m[0], y: 503 - m[1] }
}
const clicks = []
async function realClick(page, selector) {
  await calibrate(page)
  const b = await page.locator(selector).first().boundingBox()
  const x = Math.round(origin.x + b.x + b.width / 2)
  const y = Math.round(origin.y + b.y + b.height / 2)
  xdo(`mousemove ${x} ${y}`)
  await pause(120)
  xdo('click 1')
  clicks.push([x, y])
}

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.addInitScript(() => addEventListener('pointermove', (e) => (window.__move = [e.clientX, e.clientY]), true))
  await page.goto('http://localhost:4175/login.html')
  await page.bringToFront()
  const st = await Promise.race([sw.evaluate((m) => globalThis.scribe.start('Screen test', { mode: m, source: 'pick' }), mode), pause(30000).then(() => null)])
  check(st && st.recording && st.rec?.source === source, `Chrome's share dialog started a "${source}" recording (${mode})`)
  await page.bringToFront()
  await pause(800)

  await realClick(page, '#email')
  await page.keyboard.type('sam@acme.io', { delay: 30 })
  await pause(500)
  await realClick(page, 'text=Keep me signed in')
  await pause(600)
  await realClick(page, 'button[type=submit]')
  await page.waitForURL(/dashboard/)
  await pause(800)
  await realClick(page, '#new')
  await pause(1200)
  const downs = clicks
  const geom = await page.evaluate(() => ({ w: screen.width, h: screen.height, winX: screenX, winY: screenY, winW: outerWidth, winH: outerHeight }))

  const editorPromise = ctx.waitForEvent('page')
  await sw.evaluate(() => globalThis.scribe.stop(true))
  const editor = await editorPromise
  await editor.waitForLoadState()
  const guideId = new URL(editor.url()).hash.split('/')[2]
  const info = await editor.evaluate(async (id) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const get = (store, key) => new Promise((r) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => r(q.result) })
    const g = await get('guides', id)
    return { video: g.video && { source: g.video.source, w: g.video.w, h: g.video.h, duration: g.video.duration, cursor: g.video.cursor.length }, steps: g.steps.map((s) => ({ title: s.title, imageId: s.imageId, vClick: s.vClick, vRect: s.vRect, time: s.time })) }
  }, guideId)
  console.log('video:', JSON.stringify(info.video), 'screen:', geom)
  console.log('steps:\n  ' + info.steps.map((s) => `${s.title}  v=${s.vClick ? s.vClick.x.toFixed(3) + ',' + s.vClick.y.toFixed(3) : '-'}`).join('\n  '))
  check(info.video?.source === source && info.video.duration > 3000, 'video saved with its source')
  if (mode === 'video') {
    check(info.steps.length >= 4 && info.steps.every((s) => !s.imageId), 'video only: steps recorded without screenshots')
    check(editor.url().endsWith('/video'), 'video only: editor opens on the Video tab')
  } else check(info.steps.every((s) => s.imageId), 'every step has a screenshot')
  if (source === 'screen') check(info.video.w === geom.w && info.video.h === geom.h, `screen video matches the screen size (${info.video.w}x${info.video.h})`)
  if (source === 'tab') {
    // A tab shows just the page, so clicks use page positions and the cursor is drawn.
    check(info.steps.every((s) => !s.vClick) && info.video.cursor > 0, 'tab picked in the dialog: page positions and recorded mouse path')
    console.log('\nAll tab (picked) recording checks passed.')
    await ctx.close()
    server.close()
    process.exit(0)
  }
  const clicked = info.steps.filter((s) => s.vClick)
  check(clicked.length >= 4, `clicks have video positions (${clicked.length})`)
  // The "New project" click: compare with the real pointer position on screen.
  const last = clicked.at(-1)
  const [sx, sy] = downs.at(-1)
  const ex = source === 'screen' ? sx / geom.w : (sx - geom.winX) / geom.winW
  const ey = source === 'screen' ? sy / geom.h : (sy - geom.winY) / geom.winH
  const err = Math.max(Math.abs(last.vClick.x - ex) * (source === 'screen' ? geom.w : geom.winW), Math.abs(last.vClick.y - ey) * (source === 'screen' ? geom.h : geom.winH))
  console.log(`   click error: ${err.toFixed(1)}px`)
  check(err < 3, 'click position in the video matches the real pointer')
  check(last.vRect && last.vClick.x >= last.vRect.x && last.vClick.x <= last.vRect.x + last.vRect.w, 'element box lines up with the click')

  if (!editor.url().endsWith('/video')) await editor.goto(editor.url() + '/video')
  await editor.waitForSelector('canvas[aria-label="Video preview"]')
  await pause(1500)
  check((await editor.locator('[title="Zoom"]').count()) >= 1, 'auto-zoom created from the clicks')
  await editor.getByTitle('Jump here').nth(4).click()
  await pause(1500)
  await editor.locator('canvas[aria-label="Video preview"]').screenshot({ path: join(out, `screen-${source}-${mode}-preview.png`) })
  console.log(`\nAll ${source} recording checks passed.`)
} finally {
  await ctx.close()
  server.close()
}
