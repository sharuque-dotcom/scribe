// Captures the raw screens for the Chrome Web Store listing from the real
// extension, recording a short flow on the demo app in store/demo/.
// Usage: npm run build && CHROMIUM_PATH=/path/to/chrome node store/capture.mjs <rawDir>
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { activateInSettings, fakeLicenseServer } from '../tests/license-helper.mjs'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(root, 'store/raw'))
mkdirSync(out, { recursive: true })
const ext = join(root, 'dist')
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const HOST = 'billing.acme.example'
const PORT = 4190

const types = { '.html': 'text/html', '.css': 'text/css' }
const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0].replace(/^\/$/, '/customers.html')
  try {
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'text/plain' }).end(readFileSync(join(root, 'store/demo', path)))
  } catch {
    res.writeHead(404).end()
  }
}).listen(PORT)

const launch = (extra = []) =>
  chromium.launchPersistentContext('', {
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${PORT}`, ...extra],
  })
const workerOf = async (ctx) => ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
let ctx = await launch()
const extId = new URL((await workerOf(ctx)).url()).host
await ctx.close()
ctx = await launch([`--allowlisted-extension-id=${extId}`])
const sw = await workerOf(ctx)
await fakeLicenseServer(ctx)
const check = () => {}

async function clickOn(page, sel) {
  const box = await page.locator(sel).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 })
  await pause(150)
  await page.click(sel)
  await pause(700)
}

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto(`http://${HOST}/customers.html`)
  await page.mouse.move(900, 500)
  await pause(500)
  await page.bringToFront()
  await sw.evaluate(() => globalThis.scribe.start('Add a new customer in Acme Billing', { mode: 'both', source: 'tab' }))
  await pause(900)
  await clickOn(page, '#new')
  await page.waitForURL(/new/)
  await pause(1200)
  await clickOn(page, '#name'); await page.keyboard.type('Jordan Lee', { delay: 45 }); await pause(500)
  await clickOn(page, '#email'); await page.keyboard.type('jordan@bluebird.studio', { delay: 35 }); await pause(500)
  await clickOn(page, '#company'); await page.keyboard.type('Bluebird Studio', { delay: 40 }); await pause(500)
  await clickOn(page, '#plan'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await pause(900)
  await clickOn(page, '#card'); await page.keyboard.type('4242 4242 4242 4242', { delay: 30 }); await pause(700)
  await clickOn(page, '#create')
  await page.waitForURL(/added/)
  await pause(1800)

  const editorPromise = ctx.waitForEvent('page')
  await sw.evaluate(() => globalThis.scribe.stop(true))
  const editor = await editorPromise
  await editor.waitForLoadState()
  await editor.setViewportSize({ width: 1440, height: 900 })
  await editor.waitForSelector('textarea[aria-label^="Step"]')
  await pause(1500)
  await activateInSettings(editor, check)
  await pause(800)
  const base = editor.url().split('#')[0] + '#/guide/' + new URL(editor.url()).hash.split('/')[2]
  const shot = async (name) => {
    await pause(900)
    await editor.screenshot({ path: join(out, `${name}.png`) })
  }
  const scrollToStep = async (re) => {
    await editor.evaluate((src) => {
      const t = [...document.querySelectorAll('textarea[aria-label$="text"]')].find((e) => new RegExp(src).test(e.value))
      t?.closest('[id^="step-"]')?.scrollIntoView({ block: 'start' })
      window.scrollBy(0, -78)
    }, re.source)
  }

  // 1. Guide with an auto-zoomed step.
  await scrollToStep(/Work email/)
  await shot('1-guide')
  // 2. Card number blurred automatically.
  await scrollToStep(/Card number/)
  await shot('2-blur')
  // 3. SOP.
  await editor.goto(base + '/sop')
  await editor.getByRole('button', { name: /Create from steps|Use template/ }).click()
  await pause(1800)
  await shot('3-sop')
  // 4. Video.
  await editor.goto(base + '/video')
  await editor.waitForSelector('canvas[aria-label="Video preview"]')
  await pause(1500)
  await editor.getByTitle('Jump here').nth(7).click()
  await pause(1500)
  await editor.evaluate(() => window.scrollTo(0, 0))
  await shot('4-video')
  // 5. Library + popup.
  await editor.goto(editor.url().split('#')[0] + '#/')
  await shot('5-library')
  const popup = await ctx.newPage()
  await popup.setViewportSize({ width: 340, height: 560 })
  await popup.goto(`chrome-extension://${extId}/popup.html`)
  await pause(1000)
  await popup.getByRole('radio', { name: /Screenshots \+ video/ }).click()
  await pause(400)
  await popup.screenshot({ path: join(out, '5-popup.png'), clip: { x: 0, y: 0, width: 340, height: 404 } })
  console.log('Raw screens saved to', out)
} finally {
  await ctx.close()
  server.close()
}
