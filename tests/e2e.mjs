// End-to-end check: loads the built extension in Chromium, captures a short
// workflow on a local test site, then checks the editor, annotator, SOP and export.
// Usage: npm run build && CHROMIUM_PATH=/path/to/chrome node tests/e2e.mjs [outDir]
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(root, 'tests/output'))
mkdirSync(out, { recursive: true })

const server = createServer((req, res) => {
  const file = join(root, 'tests/site', (req.url ?? '/').split('?')[0].replace(/^\/$/, '/login.html'))
  let body
  try {
    body = readFileSync(file)
  } catch {
    return res.writeHead(404).end()
  }
  res.writeHead(200, { 'content-type': 'text/html' }).end(body)
}).listen(4173)

const ext = join(root, 'dist')
const ctx = await chromium.launchPersistentContext('', {
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
})
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
const extId = new URL(sw.url()).host
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (cond, msg) => {
  if (!cond) throw new Error('FAILED: ' + msg)
  console.log('ok -', msg)
}

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto('http://localhost:4173/login.html')
  await pause(500)
  await page.bringToFront()
  await sw.evaluate(() => globalThis.scribe.start('Create a project in Projectly'))
  await pause(800)
  check(await page.locator('div[style*="2147483647"]').count() === 1, 'capture bar is shown on the page')

  await page.click('#email'); await page.keyboard.type('sam@acme.io'); await pause(700)
  await page.click('#pw'); await page.keyboard.type('hunter2'); await pause(700)
  await page.click('text=Keep me signed in'); await pause(700)
  await page.click('button[type=submit]'); await page.waitForURL(/dashboard/); await pause(1200)
  await page.click('#new'); await pause(700)
  await page.click('#pname'); await page.keyboard.type('Q3 launch'); await pause(700)
  await page.click('#ptype'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await pause(700)
  await page.click('#create'); await pause(1200)

  const editorPromise = ctx.waitForEvent('page')
  await sw.evaluate(() => globalThis.scribe.stop(true))
  const editor = await editorPromise
  await editor.waitForLoadState()
  await editor.setViewportSize({ width: 1400, height: 900 })
  await editor.waitForSelector('textarea[aria-label^="Step"]')
  await pause(1500)
  const titles = await editor.$$eval('textarea[aria-label$="text"]', (els) => els.map((e) => e.value))
  console.log('captured steps:\n  ' + titles.join('\n  '))
  check(titles[0].startsWith('Go to localhost:4173/login.html'), 'first step is the starting page')
  check(titles.includes('Type "sam@acme.io" into the "Work email" field'), 'click + typing merged into one step')
  check(titles.includes('Enter your password in the "Password" field'), 'password value is never written')
  check(!titles.join(' ').includes('hunter2'), 'password text does not appear anywhere')
  check(titles.includes('Check "Keep me signed in"'), 'checkbox via its label')
  check(titles.includes('Click the "Sign in" button'), 'button click')
  check(titles.includes('Type "Q3 launch" into the "Project name" field'), 'typing on second page')
  check(titles.includes('Select "Marketing launch" from the "Template" dropdown'), 'dropdown choice')
  check(titles.at(-1) === 'Click the "Create project" button', 'last click')
  check((await editor.locator('main img[alt^="Screenshot"]').count()) === titles.length, 'every step has a screenshot')
  await editor.screenshot({ path: join(out, '1-editor.png'), fullPage: false })
  await editor.locator('#step-' + (await editor.$$eval('[id^=step-]', (e) => e[3].id.slice(5)))).scrollIntoViewIfNeeded()
  await editor.screenshot({ path: join(out, '2-editor-steps.png') })

  // Annotate: draw a box and an arrow on step 2, add a text label.
  await editor.locator('main img[alt^="Screenshot"]').nth(1).click()
  const stage = editor.locator('svg[viewBox]').last()
  const box = await stage.boundingBox()
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy]
  await editor.getByRole('button', { name: 'Box' }).click()
  await editor.mouse.move(...at(0.05, 0.05)); await editor.mouse.down(); await editor.mouse.move(...at(0.3, 0.2), { steps: 5 }); await editor.mouse.up()
  await editor.getByRole('button', { name: 'Arrow' }).click()
  await editor.mouse.move(...at(0.75, 0.15)); await editor.mouse.down(); await editor.mouse.move(...at(0.6, 0.38), { steps: 5 }); await editor.mouse.up()
  await editor.getByRole('button', { name: 'Text' }).click()
  await editor.mouse.click(...at(0.62, 0.08))
  await editor.getByLabel('Label text').fill('Use your work email')
  await editor.getByRole('button', { name: 'Blur' }).click()
  await editor.mouse.move(...at(0.05, 0.85)); await editor.mouse.down(); await editor.mouse.move(...at(0.3, 0.95), { steps: 5 }); await editor.mouse.up()
  await editor.screenshot({ path: join(out, '3-annotator.png') })
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await pause(800)

  // SOP from template, then export.
  await editor.goto(`chrome-extension://${extId}/editor.html${new URL(editor.url()).hash}/sop`)
  await editor.getByRole('button', { name: /Use template/ }).click()
  await pause(1500)
  const frame = editor.frameLocator('iframe[title="Document preview"]')
  check((await frame.locator('h2').allTextContents()).includes('4. Procedure'), 'SOP has a procedure section')
  check((await frame.locator('figure.shot img').count()) === titles.length, 'SOP shows every screenshot')
  await editor.screenshot({ path: join(out, '4-sop.png') })

  await editor.goto(`chrome-extension://${extId}/editor.html${new URL(editor.url()).hash.replace('/sop', '/training')}`)
  await editor.getByRole('button', { name: /Use template/ }).click()
  await pause(1500)
  await editor.screenshot({ path: join(out, '5-training.png') })

  await editor.goto(`chrome-extension://${extId}/editor.html${new URL(editor.url()).hash.replace('/training', '')}`)
  await editor.waitForSelector('textarea[aria-label^="Step"]')
  const dl = editor.waitForEvent('download')
  await editor.getByRole('button', { name: 'Export' }).click()
  await editor.getByRole('button', { name: 'HTML page' }).click()
  const file = await (await dl).path()
  const html = readFileSync(file, 'utf8')
  check(html.includes('Create a project in Projectly') && (html.match(/<figure class="shot">/g) ?? []).length === titles.length, 'HTML export has every step and screenshot')
  await editor.goto(`chrome-extension://${extId}/editor.html#/`)
  await pause(1200)
  await editor.screenshot({ path: join(out, '6-library.png') })

  const popup = await ctx.newPage()
  await popup.setViewportSize({ width: 340, height: 420 })
  await popup.goto(`chrome-extension://${extId}/popup.html`)
  await pause(800)
  await popup.screenshot({ path: join(out, '7-popup.png') })
  console.log('\nAll checks passed. Screenshots in', out)
} finally {
  await ctx.close()
  server.close()
}
