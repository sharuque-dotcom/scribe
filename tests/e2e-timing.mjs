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
  const box = await page.evaluate(() =>
    Object.fromEntries(['card', 'holder', 'monthly', 'yearly', 'team'].map((id) => {
      const r = document.getElementById(id).getBoundingClientRect()
      return [id, { x: r.x / innerWidth, y: r.y / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight }]
    })),
  )

  // ---- Normal speed: move the mouse, click, type like a person. ----
  const human = async (sel) => {
    const b = await page.locator(sel).boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
    await pause(180)
    await page.mouse.down(); await page.mouse.up()
  }
  await human('#monthly'); await pause(550)
  await human('#yearly'); await pause(450)
  await human('#team'); await pause(600)
  await human('#holder'); await pause(250)
  await page.keyboard.type('Jordan Lee', { delay: 80 }); await pause(500)
  await human('#monthly'); await pause(700)

  // ---- Fast: quick clicks, so step-count updates arrive while other screenshots are pending. ----
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
  const shots = await editor.evaluate(async ({ id, box, withBar }) => {
    const card = box.card
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
      // Which plan button looks selected (dark background, sampled in its left padding).
      const dark = (r) => {
        const d = ctx.getImageData(Math.round((r.x * c.width) + 4 * k), Math.round((r.y + r.h / 2) * c.height), Math.max(1, Math.round(3 * k)), Math.max(1, Math.round(3 * k))).data
        let l = 0
        for (let i = 0; i < d.length; i += 4) l += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
        return l / (d.length / 4) < 90
      }
      const sel = ['monthly', 'yearly', 'team'].filter((b) => dark(box[b])).join(',') || '-'
      const holder = count((box.holder.x + box.holder.w * 0.03) * c.width, (box.holder.y + box.holder.h * 0.25) * c.height, box.holder.w * 0.6 * c.width, box.holder.h * 0.5 * c.height, (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b < 110)
      let hash = 0
      const src = img.src
      for (let i = 0; i < src.length; i += 7) hash = (hash * 31 + src.charCodeAt(i)) | 0
      out.push({ title: s.title, green: +green.toFixed(2), bar: +bar.toFixed(2), digits: +digits.toFixed(3), sel, holder: +holder.toFixed(3), hash, png: c.toDataURL('image/jpeg', 0.7) })
    }
    return out
  }, { id: guideId, box, withBar })
  shots.forEach((s, i) => writeFileSync(join(out, `timing-${i}.jpg`), Buffer.from(s.png.split(',')[1], 'base64')))
  console.log(shots.map((s, i) => `  ${i} ${s.title}  sel=${s.sel} holder=${s.holder} green=${s.green} bar=${s.bar} digits=${s.digits} img=${s.hash}`).join('\n'))

  const control = shots.pop()
  check(control.bar > 0.2, `control: the bar check sees the bar on a normal screenshot (${control.bar})`)
  // Normal speed: each step shows the page just before its action.
  const steps = shots.filter((s) => !s.title.startsWith('CONTROL'))
  const at = (re, n = 0) => steps.filter((s) => re.test(s.title))[n]
  check(at(/"Yearly"/)?.sel === 'monthly', `"Click Yearly" shows Monthly still selected (before the click), got ${at(/"Yearly"/)?.sel}`)
  check(at(/"Team"/)?.sel === 'yearly', `"Click Team" shows Yearly still selected, got ${at(/"Team"/)?.sel}`)
  check(at(/Jordan Lee/)?.holder > 0.01, 'the typing step shows the typed name')
  check(at(/"Monthly"/, 1)?.sel === 'team', `the second "Click Monthly" shows Team selected, got ${at(/"Monthly"/, 1)?.sel}`)
  // From the first click (the opening 'Go to' step legitimately matches it: nothing changed yet).
  const normal = steps.slice(steps.indexOf(at(/"Monthly"/)), steps.indexOf(at(/"Monthly"/, 1)) + 1)
  // Typing that ends with a click shares that moment's screenshot (the editor zooms each on its own field).
  const same = normal.slice(1).filter((s, i) => s.hash === normal[i].hash && !/^(Type|Enter)/.test(normal[i].title)).map((s) => s.title)
  check(same.length === 0, `no two consecutive steps share an image at normal speed${same.length ? ' (' + same.join('; ') + ')' : ''}`)

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
