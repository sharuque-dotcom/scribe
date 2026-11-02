// Screenshot timing check: clicks and types at real speed (no pauses), then
// checks the saved screenshots show the right page and never the control bar.
// Usage: npm run build && CHROMIUM_PATH=/path/to/chrome node tests/e2e-timing.mjs [outDir]
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(root, 'tests/output'))
mkdirSync(out, { recursive: true })

const server = createServer((req, res) => {
  const file = join(root, 'tests/site', (req.url ?? '/').split('?')[0].replace(/^\/$/, '/billing.html'))
  let body
  try {
    body = readFileSync(file)
  } catch {
    return res.writeHead(404).end()
  }
  res.writeHead(200, { 'content-type': 'text/html' }).end(body)
}).listen(4176)

const ext = join(root, 'dist')
const ctx = await chromium.launchPersistentContext('', {
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
})
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = false
const check = (cond, msg) => {
  console.log(cond ? 'ok -' : 'NOT OK -', msg)
  if (!cond) failed = true
}

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto('http://localhost:4176/billing.html')
  await pause(400)
  await page.bringToFront()
  await sw.evaluate(() => globalThis.scribe.start('Save a card'))
  await pause(1500)
  // A normal screenshot with the bar showing, to prove the bar check can see it.
  const withBar = 'data:image/png;base64,' + (await page.screenshot()).toString('base64')
  // Where things are, as 0..1 of the page.
  const box = await page.evaluate(() => {
    const r = document.getElementById('card').getBoundingClientRect()
    return { card: { x: r.x / innerWidth, y: r.y / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight } }
  })

  // Quick clicks, so step-count updates arrive while other screenshots are pending.
  await page.click('#monthly'); await pause(120)
  await page.click('#yearly'); await pause(120)
  await page.click('#team'); await pause(120)
  // Type a card number and save straight away; Save opens the Deals page.
  await page.click('#card')
  await page.keyboard.type('4242424242424242')
  await page.click('#save')
  await page.waitForURL(/deals/)
  await pause(2000)

  const editorPromise = ctx.waitForEvent('page')
  await sw.evaluate(() => globalThis.scribe.stop(true))
  const editor = await editorPromise
  await editor.waitForLoadState()
  const guideId = new URL(editor.url()).hash.split('/')[2]
  const shots = await editor.evaluate(async ({ id, card, withBar }) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const get = (store, key) => new Promise((r) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => r(q.result) })
    const g = await get('guides', id)
    const out = []
    const items = [...g.steps.map((s) => ({ title: s.title, imageId: s.imageId })), { title: 'CONTROL: page with bar', url: withBar }]
    for (const s of items) {
      const img = new Image()
      img.src = s.url ?? (await get('images', s.imageId)).dataUrl
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const k = c.width / 1280
      const count = (x, y, w, h, test) => {
        const d = ctx.getImageData(Math.round(x), Math.round(y), Math.round(w), Math.round(h)).data
        let n = 0
        for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) n++
        return n / (d.length / 4)
      }
      // Deals page: big green header across the top.
      const green = count(300 * k, 40 * k, 600 * k, 100 * k, (r, g, b) => g > 140 && r < 60 && b < 110)
      // Control bar: dark pill, bottom right.
      const bar = count(c.width - 330 * k, c.height - 80 * k, 320 * k, 70 * k, (r, g, b) => r < 40 && g < 45 && b < 60)
      // Dark pixels (typed digits) inside the card field.
      const digits = count((card.x + card.w * 0.03) * c.width, (card.y + card.h * 0.25) * c.height, card.w * 0.7 * c.width, card.h * 0.5 * c.height, (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b < 110)
      out.push({ title: s.title, green: +green.toFixed(2), bar: +bar.toFixed(2), digits: +digits.toFixed(3), png: c.toDataURL('image/jpeg', 0.7) })
    }
    return out
  }, { id: guideId, card: box.card, withBar })
  shots.forEach((s, i) => writeFileSync(join(out, `timing-${i}.jpg`), Buffer.from(s.png.split(',')[1], 'base64')))
  console.log(shots.map((s) => `  ${s.title}  green=${s.green} bar=${s.bar} digits=${s.digits}`).join('\n'))

  const control = shots.pop()
  check(control.bar > 0.2, `control: the bar check sees the bar on a normal screenshot (${control.bar})`)
  const cardStep = shots.find((s) => /card number/i.test(s.title))
  const saveStep = shots.find((s) => /Save card/.test(s.title))
  check(!!cardStep && !!saveStep, 'card and Save steps were recorded')
  check(cardStep && cardStep.green < 0.1, 'card step shows the billing page, not the next page')
  check(saveStep && saveStep.green < 0.1, 'Save click shows the billing page, not the next page')
  check(cardStep && cardStep.digits === 0, 'card number is pixelated in the saved screenshot')
  check(shots.every((s) => s.bar < 0.05), 'control bar is not in any screenshot')
  console.log(failed ? '\nTiming checks FAILED.' : '\nAll timing checks passed.')
} finally {
  await ctx.close()
  server.close()
}
process.exit(failed ? 1 : 0)
