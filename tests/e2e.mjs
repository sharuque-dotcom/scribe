// End-to-end check: loads the built extension in Chromium, captures a short
// workflow on a local test site, then checks the editor, annotator, SOP and export.
// Usage: npm run build && CHROMIUM_PATH=/path/to/chrome node tests/e2e.mjs [outDir]
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import JSZip from 'jszip'
import { activateInSettings, fakeLicenseServer, TEST_KEY } from './license-helper.mjs'
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
const polar = await fakeLicenseServer(ctx)
await ctx.route('https://buy.polar.sh/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Checkout</title>' }))
// Every request the extension makes (to check that only the license check goes online).
const requests = []
const counts = []
ctx.on('request', (r) => {
  requests.push(r.url())
  if (r.url().startsWith('https://www.stepcrumb.com/api/count')) counts.push(r.postData())
})
// Anonymous counts go to a stub here, so tests never add to the real numbers.
await ctx.route('https://www.stepcrumb.com/api/count', (r) => r.fulfill({ status: 202, body: '{"ok":true}' }))
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
  // Where the email and password fields sit, as 0..1 of the page (for the saved-image check below).
  const fields = await page.evaluate(() => Object.fromEntries(['email', 'pw'].map((id) => {
    const r = document.getElementById(id).getBoundingClientRect()
    return [id, { x: r.x / innerWidth, y: r.y / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight }]
  })))
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
  check(titles.includes('Type an email address into the "Work email" field'), 'click + typing merged into one step')
  check(titles.includes('Enter your password in the "Password" field'), 'password value is never written')
  check(!titles.join(' ').includes('hunter2'), 'password text does not appear anywhere')

  // The saved screenshot itself (not just the editor view) has the password field pixelated.
  const guideId = new URL(editor.url()).hash.split('/')[2]
  const dark = await editor.evaluate(async ({ id, fields }) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const get = (store, key) => new Promise((r) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => r(q.result) })
    const g = await get('guides', id)
    const out = []
    // Steps taken on the sign-in page after the password was typed.
    const at = g.steps.findIndex((s) => /password/i.test(s.title))
    for (const s of g.steps.slice(at, at + 2)) {
      const stored = await get('images', s.imageId)
      const img = new Image()
      img.src = stored.dataUrl
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      // Count dark pixels (typed characters or password dots) inside each field, away from its border.
      const darkIn = (r) => {
        const x = Math.round((r.x + r.w * 0.04) * c.width), y = Math.round((r.y + r.h * 0.2) * c.height)
        const w = Math.round(r.w * 0.6 * c.width), h = Math.round(r.h * 0.6 * c.height)
        const d = ctx.getImageData(x, y, w, h).data
        let n = 0
        for (let i = 0; i < d.length; i += 4) if (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2] < 110) n++
        return n
      }
      out.push({ title: s.title, email: darkIn(fields.email), pw: darkIn(fields.pw) })
    }
    return out
  }, { id: guideId, fields })
  console.log('   dark pixels in saved images:', JSON.stringify(dark))
  check(dark.length === 2 && dark.every((d) => d.email > 20), 'saved images show the (non-secret) email text, so the check can see text')
  check(dark.every((d) => d.pw === 0), 'password field is pixelated in the saved screenshot files')
  check(titles.includes('Check "Keep me signed in"'), 'checkbox via its label')
  check(titles.includes('Click the "Sign in" button'), 'button click')
  check(titles.includes('Type "Q3 launch" into the "Project name" field'), 'typing on second page')
  check(titles.includes('Select "Marketing launch" from the "Template" dropdown'), 'dropdown choice')
  check(titles.at(-1) === 'Click the "Create project" button', 'last click')
  check((await editor.locator('main img[alt^="Screenshot"]').count()) === titles.length, 'every step has a screenshot')
  // Zoom: first step on each page is full screen, later ones zoom in (16:10 frame + label).
  const shapes = await editor.$$eval('main img[alt^="Screenshot"]', (els) => els.map((i) => +(i.naturalWidth / i.naturalHeight).toFixed(2)))
  const zoomLabels = await editor.$$eval('[aria-label="Screenshot zoom"]', (els) => els.map((e) => e.parentElement.lastElementChild.textContent))
  console.log('zoom per step:\n  ' + zoomLabels.join('\n  '))
  check(zoomLabels[0] === 'Full screen' && shapes[0] === 1.6, 'first step stays full screen')
  check(zoomLabels[1].startsWith('Auto zoom') && shapes[1] === 1.6, 'typing step on the same page is zoomed')
  check(zoomLabels[5] === 'Full screen: first step on this page', 'first click on the new page is full screen')
  check(zoomLabels.filter((l) => l.startsWith('Auto zoom')).length >= 5, 'most steps are zoomed')
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

  // Switching one step to full screen, then back to auto.
  const zoomGroup = editor.locator('[aria-label="Screenshot zoom"]').nth(1)
  await zoomGroup.scrollIntoViewIfNeeded()
  await zoomGroup.getByRole('button', { name: 'Full screen' }).click()
  await editor.waitForTimeout(400)
  check((await zoomGroup.locator('xpath=..').locator('span').last().textContent()) === 'Full screen', 'a step can be switched to full screen')
  await zoomGroup.getByRole('button', { name: 'Zoom' }).click()
  await editor.waitForTimeout(400)
  check((await editor.getByLabel('Zoom level').count()) === 1, 'custom zoom shows a zoom slider')
  await zoomGroup.getByRole('button', { name: 'Auto' }).click()
  await editor.waitForTimeout(400)

  // SOP from template, then export.
  await editor.goto(`chrome-extension://${extId}/editor.html${new URL(editor.url()).hash}/sop`)
  await pause(600)
  check((await editor.getByText(/Claude/).count()) === 0, 'Claude features are switched off (no buttons or text)')
  await editor.getByRole('button', { name: /Use template|Create from steps/ }).click()
  await pause(1500)
  const frame = editor.frameLocator('iframe[title="Document preview"]')
  check((await frame.locator('h2').allTextContents()).includes('4. Procedure'), 'SOP has a procedure section')
  check((await frame.locator('figure.shot img').count()) === titles.length, 'SOP shows every screenshot')
  await editor.screenshot({ path: join(out, '4-sop.png') })

  await editor.goto(`chrome-extension://${extId}/editor.html${new URL(editor.url()).hash.replace('/sop', '/training')}`)
  await editor.getByRole('button', { name: /Use template|Create from steps/ }).click()
  await pause(1500)
  await editor.screenshot({ path: join(out, '5-training.png') })

  await editor.goto(`chrome-extension://${extId}/editor.html${new URL(editor.url()).hash.replace('/training', '')}`)
  await editor.waitForSelector('textarea[aria-label^="Step"]')

  // ---------- Free plan ----------
  check((await editor.getByRole('button', { name: 'Free · Upgrade' }).count()) === 1, 'free plan badge shown')
  await editor.getByRole('button', { name: 'Export' }).click()
  check((await editor.getByRole('button', { name: 'PDF (with StepCrumb footer)' }).count()) === 1, 'free PDF export is labelled as branded')
  await editor.getByRole('button', { name: /HTML page/ }).click()
  await editor.getByText('Pro feature: HTML export.').waitFor()
  check(true, 'free plan: HTML export is locked')
  await editor.getByRole('button', { name: 'Export' }).click()
  await editor.getByRole('button', { name: /Word \(\.docx\)/ }).click()
  await editor.getByText('Pro feature: Word export.').waitFor()
  check(true, 'free plan: Word export is locked')
  await editor.goto(editor.url() + '/preview')
  const previewFrame = editor.frameLocator('iframe[title="Guide preview"]')
  await previewFrame.locator('footer.brand').waitFor()
  check((await previewFrame.locator('footer.brand').textContent()).includes('Made with StepCrumb'), 'free plan: guide (and its PDF) carries the StepCrumb footer')
  check((await previewFrame.locator('footer.brand a').getAttribute('href'))?.startsWith('https://www.stepcrumb.com'), 'the footer links to stepcrumb.com')
  await editor.goto(editor.url().replace('/preview', ''))
  await editor.waitForSelector('textarea[aria-label^="Step"]')

  // ---------- Paid plan ----------
  await activateInSettings(editor, check)
  check(polar.calls.some((c) => c.path.endsWith('/activate') && c.body.key === TEST_KEY), 'activation called Polar')
  check(polar.calls.every((c) => Object.keys(c.body).every((k) => ['key', 'organization_id', 'label', 'activation_id'].includes(k))), 'license calls send only the key, organization and activation')
  const dl = editor.waitForEvent('download')
  await editor.getByRole('button', { name: 'Export' }).click()
  await editor.getByRole('button', { name: 'HTML page' }).click()
  const file = await (await dl).path()
  const html = readFileSync(file, 'utf8')
  check(html.includes('Create a project in Projectly') && (html.match(/<figure class="shot">/g) ?? []).length === titles.length, 'HTML export has every step and screenshot')
  check(!html.includes('Made with StepCrumb'), 'paid plan: no StepCrumb footer')
  const wordDl = editor.waitForEvent('download')
  await editor.getByRole('button', { name: 'Export' }).click()
  await editor.getByRole('button', { name: 'Word (.docx)' }).click()
  const word = await wordDl
  check(word.suggestedFilename().endsWith('.docx'), 'paid plan: Word export downloads a .docx')
  const zip = await JSZip.loadAsync(readFileSync(await word.path()))
  const xml = await zip.file('word/document.xml').async('string')
  const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/'))
  check(xml.includes('Create a project in Projectly') && xml.includes('Q3 launch') && media.length === titles.length, `Word file has the steps and ${media.length} screenshots`)
  // SOP as Word.
  await editor.goto(editor.url() + '/sop')
  const sopDl = editor.waitForEvent('download')
  await editor.getByRole('button', { name: 'Export' }).click()
  await editor.getByRole('button', { name: 'Word (.docx)' }).click()
  const sopZip = await JSZip.loadAsync(readFileSync(await (await sopDl).path()))
  const sopXml = await sopZip.file('word/document.xml').async('string')
  check(sopXml.includes('Procedure') && sopXml.includes('<w:tbl>'), 'SOP exports to Word with its sections and table')
  await editor.goto(`chrome-extension://${extId}/editor.html#/`)
  await pause(1200)
  await editor.screenshot({ path: join(out, '6-library.png') })

  // ---------- Subscription cancelled ----------
  polar.revoke()
  const after = await sw.evaluate(() => globalThis.scribe.recheckLicense(true))
  check(after?.status === 'revoked', 'a re-check after cancellation marks the key revoked')
  await editor.reload()
  await editor.getByRole('button', { name: 'Free · Upgrade' }).waitFor()
  check(true, 'the app drops back to Free')
  check((await editor.getByText('Create a project in Projectly').count()) >= 1, 'local guides are still there')
  await editor.getByRole('button', { name: 'Free · Upgrade' }).click()
  await editor.getByText('Your Pro access has ended').waitFor()
  check(true, 'explains that Pro ended and guides are safe')
  await editor.keyboard.press('Escape')

  // Network: only Polar (the license check) and the local test site.
  const outside = [...new Set(requests.map((u) => new URL(u)).filter((u) => /^https?:$/.test(u.protocol) && u.hostname !== 'localhost').map((u) => u.hostname))]
  console.log('   hosts contacted:', outside.join(', ') || '(none)')
  check(outside.every((h) => h === 'api.polar.sh' || h === 'www.stepcrumb.com'), 'nothing but the license check and anonymous counts goes online')
  check(requests.filter((u) => u.includes('www.stepcrumb.com')).every((u) => u === 'https://www.stepcrumb.com/api/count'), 'stepcrumb.com is only contacted for counts')
  check(counts.every((b) => { try { const o = JSON.parse(b ?? ''); return Object.keys(o).join() === 'e' && /^[a-z_]+$/.test(o.e) } catch { return false } }), `counts carry only an event name (${counts.length} sent: ${[...new Set(counts.map((b) => JSON.parse(b ?? '{}').e))].join(', ')})`)

  const popup = await ctx.newPage()
  await popup.setViewportSize({ width: 340, height: 420 })
  await popup.goto(`chrome-extension://${extId}/popup.html`)
  await popup.getByRole('button', { name: 'Upgrade to Pro' }).waitFor()
  check((await popup.getByRole('button', { name: 'Enter license key' }).count()) === 1, 'popup offers Upgrade to Pro and Enter license key')
  await popup.screenshot({ path: join(out, '7-popup.png') })
  const checkout = ctx.waitForEvent('page')
  await popup.getByRole('button', { name: 'Upgrade to Pro' }).click()
  const checkoutPage = await checkout
  await checkoutPage.waitForURL(/buy\.polar\.sh/, { timeout: 10000 }).catch(() => {})
  console.log('   checkout tab:', checkoutPage.url())
  check(/^https:\/\/(buy\.polar\.sh\/polar_cl_|polar\.sh\/checkout\/)/.test(checkoutPage.url()), 'Upgrade to Pro opens the Polar checkout')
  await checkoutPage.close()
  // Enter license key: the key goes in right here in the popup.
  polar.restore()
  await popup.getByRole('button', { name: 'Enter license key' }).click()
  await popup.getByLabel('License key').fill('STEPCRUMB-NOPE')
  await popup.getByRole('button', { name: 'Activate' }).click()
  await popup.getByRole('alert').filter({ hasText: 'wasn’t found' }).waitFor()
  check(true, 'popup: a wrong key shows an error')
  await popup.getByLabel('License key').fill(TEST_KEY)
  await popup.getByRole('button', { name: 'Activate' }).click()
  await popup.getByText('StepCrumb Pro · active').waitFor()
  check(true, 'popup: entering the key activates Pro right in the popup')
  check((await popup.getByText('Pro', { exact: true }).count()) >= 1, 'popup badge shows Pro')
  console.log('\nAll checks passed. Screenshots in', out)
} finally {
  await ctx.close()
  server.close()
}
