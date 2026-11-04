// Step screenshots show the right moment (from QA of a real guide):
// - A menu that is still fading in isn't captured half-drawn on top of the page.
// - Scrolling and clicking quickly uses a screenshot of the part of the page that
//   was clicked, not an older one from further up.
// - A menu item that starts with an avatar letter is named by its text.
// Run: npm run build && node tests/e2e-shots.mjs
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
}).listen(4181)
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
// The colour of a step's screenshot at a point (0..1 of the image).
const pixel = (guideId, title, x, y) =>
  sw.evaluate(
    async ({ guideId, title, x, y }) => {
      const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
      const get = (store, id) => new Promise((r) => { const t = db.transaction(store).objectStore(store).get(id); t.onsuccess = () => r(t.result) })
      const g = await get('guides', guideId)
      const step = g.steps.find((s) => s.title.includes(title))
      if (!step?.imageId) return { titles: g.steps.map((s) => s.title) }
      const img = await get('images', step.imageId)
      const bmp = await createImageBitmap(await (await fetch(img.dataUrl)).blob())
      const c = new OffscreenCanvas(bmp.width, bmp.height)
      const ctx = c.getContext('2d')
      ctx.drawImage(bmp, 0, 0)
      const d = ctx.getImageData(Math.round(x * bmp.width), Math.round(y * bmp.height), 1, 1).data
      return { rgb: [d[0], d[1], d[2]], titles: g.steps.map((s) => s.title) }
    },
    { guideId, title, x, y },
  )

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  for (let run = 1; run <= 3; run++) {
    await page.goto('http://localhost:4181/shots.html')
    await pause(400)
    const st = await sw.evaluate(() => globalThis.scribe.start('Screenshot checks'))
    await pause(1000)

    // 1. Open the slowly fading menu and pick the first item a moment later.
    //    The spare screenshot is requested while the menu is still fading in.
    await page.click('#open')
    await pause(1300)
    const item = await page.locator('#item').boundingBox()
    await page.mouse.click(item.x + item.width / 2, item.y + item.height - 8)
    await pause(900)

    // 2. Scroll down to the button and click it straight away.
    await page.mouse.move(640, 400)
    await page.mouse.wheel(0, 1600)
    await pause(120)
    const req = await page.locator('#request').boundingBox()
    await page.mouse.click(req.x + req.width / 2, req.y + req.height / 2)
    await pause(1200)
    await sw.evaluate(() => globalThis.scribe.stop(false))

    const vp = page.viewportSize()
    const menuPx = await pixel(st.guideId, 'Erth', (item.x + item.width - 20) / vp.width, (item.y + 6) / vp.height)
    console.log(`run ${run} steps:`, menuPx.titles)
    check(menuPx.titles.some((t) => t.includes(`"Erth's Lovable"`)), `run ${run}: the menu item is named "Erth's Lovable", not its avatar letter`)
    const [r, g, b] = menuPx.rgb ?? [0, 0, 0]
    check(b > 200 && r < 60 && g < 60, `run ${run}: the menu step shows the menu fully drawn (pixel ${menuPx.rgb})`)
    // Beside the button, the page is green (the part that was clicked), not red (the top).
    const reqPx = await pixel(st.guideId, 'Request pilot access', (req.x + req.width + 40) / vp.width, (req.y + req.height / 2) / vp.height)
    const [r2, g2] = reqPx.rgb ?? [0, 0, 0]
    check(g2 > r2, `run ${run}: the "Request pilot access" step shows the part of the page that was clicked (pixel ${reqPx.rgb})`)
  }
  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll screenshot checks passed.')
  process.exitCode = failures ? 1 : 0
} finally {
  await ctx.close()
  server.close()
}
