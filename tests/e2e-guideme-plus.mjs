// Guide me, beyond the basics (no AI, just rules and what the page shows):
//  1 self-repair    2 health check    3 smart waiting    4 already done
//  5 checking input 6 off track       7 practice mode    8 guides for this page
//  9 sharing by file
// Run: npm run build && node tests/e2e-guideme-plus.mjs
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
}).listen(4182)
const BASE = 'http://localhost:4182'
const ext = join(root, 'dist')
const ctx = await chromium.launchPersistentContext('', { executablePath: process.env.CHROMIUM_PATH, headless: true, viewport: { width: 1280, height: 800 }, acceptDownloads: true, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] })
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
// Anonymous counts go to a stub, so tests never add to the real numbers.
await ctx.route('https://www.stepcrumb.com/api/count', (r) => r.fulfill({ status: 202, body: '{"ok":true}' }))
const extId = new URL(sw.url()).host
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (cond, msg) => {
  if (!cond) failures++
  console.log(cond ? 'ok  ' : 'FAIL', '-', msg)
}
async function waitFor(fn, ms = 8000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn().catch(() => null)
    if (v || Date.now() > end) return v
    await pause(150)
  }
}
// The card and spotlight, once the spotlight has stopped gliding to its target.
const ui = (page) =>
  page.evaluate(async () => {
    const ringOf = () => {
      const ring = document.querySelector('[data-stepcrumb-guide]')?.shadowRoot?.querySelector('.ring')
      return ring && !ring.classList.contains('hidden') ? ring.getBoundingClientRect() : null
    }
    for (let i = 0; i < 20; i++) {
      const a = ringOf()
      await new Promise((r) => setTimeout(r, 60))
      const b = ringOf()
      if (!a || !b || (a.left === b.left && a.top === b.top && a.width === b.width)) break
    }
    const r = document.querySelector('[data-stepcrumb-guide]')?.shadowRoot
    if (!r) return null
    const ring = r.querySelector('.ring')
    const rr = ring && !ring.classList.contains('hidden') ? ring.getBoundingClientRect() : null
    const under = rr ? document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2) : null
    return {
      count: r.querySelector('.count')?.textContent,
      title: r.querySelector('.title')?.textContent,
      note: r.querySelector('.note:not(.hidden)')?.textContent ?? null,
      flash: r.querySelector('.flash:not(.hidden)')?.textContent ?? null,
      practice: !r.querySelector('.practice')?.classList.contains('hidden'),
      buttons: [...r.querySelectorAll('.buttons button')].map((b) => b.textContent),
      under: under ? under.id || under.tagName.toLowerCase() : null,
      ring: rr && { x: rr.left + rr.width / 2, y: rr.top + rr.height / 2 },
    }
  })
const clickCard = (page, label) =>
  page.evaluate((label) => {
    const r = document.querySelector('[data-stepcrumb-guide]').shadowRoot
    ;[...r.querySelectorAll('button')].find((b) => b.textContent === label || b.getAttribute('aria-label') === label).click()
  }, label)
const gstate = () => sw.evaluate(async () => (await chrome.storage.session.get('guideMe')).guideMe ?? null)
const getGuide = (id) =>
  sw.evaluate(async (id) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    return new Promise((r) => { const t = db.transaction('guides').objectStore('guides').get(id); t.onsuccess = () => r(t.result) })
  }, id)
// Start Guide me the way the editor and popup do (from an extension page).
async function start(guideId, practice = false) {
  const p = await ctx.newPage()
  await p.goto(`chrome-extension://${extId}/editor.html#/`)
  const res = await p.evaluate(({ guideId, practice }) => chrome.runtime.sendMessage({ type: 'guide-start', guideId, practice }), { guideId, practice })
  await p.close()
  return res
}
const stopGuide = () => sw.evaluate(() => chrome.storage.session.remove('guideMe'))
const stepIndex = (g, text) => g.steps.findIndex((s) => s.title.includes(text))

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())

  // ---- Record a guide on the CRM page ----
  await page.goto(`${BASE}/crm.html`)
  await pause(400)
  const st = await sw.evaluate(() => globalThis.scribe.start('Add a contact'))
  await pause(800)
  await page.click('#new'); await pause(600)
  await page.click('#name'); await page.keyboard.type('Jordan Lee'); await pause(500)
  await page.click('#stage'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await pause(600)
  await page.click('#vip'); await pause(500)
  await page.click('#save'); await pause(900)
  await sw.evaluate(() => globalThis.scribe.stop(false))
  const guideId = st.guideId
  let guide = await getGuide(guideId)
  console.log('recorded:\n  ' + guide.steps.map((s) => s.title).join('\n  '))
  const iNew = stepIndex(guide, 'New contact')
  const iName = stepIndex(guide, 'Full name')
  const iStage = stepIndex(guide, 'Stage')
  const iVip = stepIndex(guide, 'VIP')
  const iSave = stepIndex(guide, 'Save contact')
  check([iNew, iName, iStage, iVip, iSave].every((i) => i >= 0), 'the CRM guide has all its steps')
  check(guide.steps[iStage].title.includes('"Customer"'), 'the dropdown step quotes the choice (Customer)')

  // ---- 8. Guides for this page: badge on the icon ----
  await page.goto(`${BASE}/crm.html`)
  await pause(1200)
  const badge = await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: 'http://localhost:4182/crm.html*' })
    return { text: await chrome.action.getBadgeText({ tabId: t.id }) }
  })
  // The popup asks the background for the list, as any extension page can.
  const extPage = await ctx.newPage()
  await extPage.goto(`chrome-extension://${extId}/editor.html#/`)
  badge.list = await extPage.evaluate((url) => chrome.runtime.sendMessage({ type: 'guides-for-page', url }), `${BASE}/crm.html`)
  await extPage.close()
  await page.bringToFront()
  check(badge.text === '1' && badge.list.length === 1 && badge.list[0].title === 'Add a contact', `the icon shows "1" guide for this page (badge "${badge.text}")`)
  await page.goto(`${BASE}/reports.html`)
  await pause(800)
  const noBadge = await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: 'http://localhost:4182/reports.html*' })
    return chrome.action.getBadgeText({ tabId: t.id })
  })
  check(noBadge === '', 'no count on a page without guides')

  // ---- 1. Self-repair: the button got a new id ----
  await page.goto(`${BASE}/crm.html?renamed=1`)
  await start(guideId)
  let u = await waitFor(async () => {
    const v = await ui(page)
    return v?.ring && v.title.includes('New contact') ? v : null
  })
  check(u?.under === 'add-contact', 'a button with a new id is still found by its other clues')
  await page.mouse.click(u.ring.x, u.ring.y)
  await waitFor(async () => (await gstate())?.index > iNew)
  await pause(500)
  guide = await getGuide(guideId)
  check(guide.steps[iNew].locator.id === 'add-contact' && guide.repaired?.stepIds.includes(guide.steps[iNew].id), 'the step is repaired with the new id and noted for the author')
  await clickCard(page, 'Exit Guide me')
  await pause(400)
  guide = await getGuide(guideId)
  check(guide.health?.source === 'play' && guide.health.results[guide.steps[iNew].id] === 'repaired', 'the play is saved as the guide\'s health (step marked repaired)')

  // ---- 3. Smart waiting: the button appears after a few seconds ----
  await page.goto(`${BASE}/crm.html?slow=1`)
  await start(guideId)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.note ? v : null
  }, 5000)
  check(u && /Waiting for the page to load/.test(u.note), 'while the page loads (spinner), it says it is waiting')
  await pause(2500)
  u = await ui(page)
  check(!/can't find/.test(u?.note ?? ''), 'it does not give up while the page is still loading')
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.ring ? v : null
  }, 9000)
  check(u?.under === 'new', 'once the button appears, the spotlight finds it')
  await stopGuide()

  // ---- 4 + 5 + 7. Already done, checking input, practice mode ----
  await page.goto(`${BASE}/crm.html?open=1`)
  await start(guideId, true)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v && v.title.includes('Stage') ? v : null
  }, 12000)
  check(!!u, 'the form is already open and filled in, so it moves on to the Stage step')
  check(u && /already/.test(u.flash ?? ''), `it says the earlier steps were already done ("${u?.flash}")`)
  check(u?.practice, 'practice mode is shown on the card')
  const results = (await gstate())?.results ?? {}
  check(results[iNew] === 'skipped' && (results[iName] === 'found' || results[iName] === 'repaired'), 'the skipped click is noted as skipped, the filled field as found')
  // Choose a different stage than the guide.
  await page.selectOption('#stage', 'Lead')
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.note?.includes('you picked') ? v : null
  })
  check(u && u.note.includes('“Customer”') && u.note.includes('“Lead”') && u.buttons.includes('Keep mine'), 'a different dropdown choice is pointed out ("The guide picked Customer; you picked Lead")')
  await clickCard(page, 'Keep mine')
  await waitFor(async () => (await gstate())?.index === iVip)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.ring ? v : null
  })
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.ring && v.under === 'vip' ? v : null
  })
  await page.mouse.click(u.ring.x, u.ring.y)
  await waitFor(async () => (await gstate())?.index === iSave)
  // Empty the required name, then press Save: it points at the field instead.
  await page.fill('#name', '')
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.ring && v.title.includes('Save') ? v : null
  })
  await page.mouse.click(u.ring.x, u.ring.y)
  await pause(300)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.note?.includes('Fill in') ? v : null
  })
  check(u && u.note.includes('“Full name”') && u.under === 'name', 'an empty required field is pointed out before Save ("Fill in “Full name”…")')
  await page.fill('#name', 'Jordan Lee')
  await pause(400)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.ring && v.under === 'save' ? v : null
  })
  await page.mouse.click(u.ring.x, u.ring.y)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.title?.startsWith('Done') ? v : null
  })
  check(!!u && /Practice/.test(u.flash ?? ''), 'practice: Save counts as done and says it wasn\'t sent')
  check((await page.evaluate(() => window.saves)) === 0 && (await page.textContent('#status')) === '', 'practice: the app never received the Save')
  await clickCard(page, 'Close')
  await pause(300)

  // ---- 6. Off track ----
  await page.goto(`${BASE}/crm.html`)
  await start(guideId)
  await waitFor(async () => (await ui(page))?.ring)
  await waitFor(async () => (await gstate())?.path)
  await page.click('#reports')
  await page.waitForURL(/reports/)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.note?.includes('That opened') ? v : null
  })
  check(u && u.note.includes('Reports') && u.buttons.includes('Go to the page'), 'leaving the step\'s page says "That opened Reports…" and offers to go back')
  await clickCard(page, 'Go to the page')
  await page.waitForURL(/crm/)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.ring ? v : null
  })
  check(u?.under === 'new', 'going back puts the spotlight on the step again')
  await clickCard(page, 'Exit Guide me')

  // ---- 2. Check this guide ----
  const editor = await ctx.newPage()
  await editor.goto(`chrome-extension://${extId}/editor.html#/guide/${guideId}`)
  await editor.getByRole('button', { name: 'Guide me options' }).click()
  await editor.getByRole('button', { name: /Check this guide/ }).click()
  await waitFor(async () => (await getGuide(guideId)).health?.source === 'check', 30000)
  guide = await getGuide(guideId)
  // The step was repaired to the renamed button's id earlier; on the normal page the check repairs it back.
  check(['found', 'repaired'].includes(guide.health.results[guide.steps[iNew].id]) && guide.steps[iNew].locator.id === 'new', 'Check this guide finds the first button on the page without clicking anything (and repairs it back to the current id)')
  check(['unchecked', 'found'].includes(guide.health.results[guide.steps[iName].id]), 'fields that appear after a step are not marked broken')
  const chip = await waitFor(async () => {
    const t = await editor.getByText(/Guide me: \d+ of \d+ steps OK/).first().textContent()
    return t
  })
  check(!!chip, `the guide page shows the health score ("${chip}")`)
  check((await editor.getByText(/repaired 1 step after the app changed/).count()) === 1 && (await editor.getByText('Repaired by Guide me').count()) === 1, 'the guide page says a step was repaired, and marks it')
  await editor.screenshot({ path: join(root, 'tests/output/guideme-health.png') })

  // ---- 9. Share by file, import by dropping it on the library ----
  await editor.getByRole('button', { name: 'Guide me options' }).click()
  await editor.getByRole('button', { name: /Share for Guide me/ }).click()
  const [download] = await Promise.all([editor.waitForEvent('download'), editor.getByRole('button', { name: 'Download the file' }).click()])
  const text = readFileSync(await download.path(), 'utf8')
  check(JSON.parse(text).format === 'stepcrumb-guide', 'Share downloads a StepCrumb file')
  await editor.goto(`chrome-extension://${extId}/editor.html#/`)
  await editor.waitForTimeout(800)
  await editor.evaluate((text) => {
    const dt = new DataTransfer()
    dt.items.add(new File([text], 'add-a-contact.stepcrumb.json', { type: 'application/json' }))
    const target = document.querySelector('main') ?? document.body
    const el = [...document.querySelectorAll('div')].find((d) => d.className.includes('max-w-6xl')) ?? target
    for (const type of ['dragover', 'drop']) el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, text)
  await editor.waitForURL(/#\/guide\//)
  const importedId = editor.url().split('#/guide/')[1]
  check(importedId && importedId !== guideId, 'dropping the file on the library imports it as a new guide')
  check((await editor.getByText(/Imported\. Press/).count()) === 1, 'the imported guide says how to play it')
  const imported = await getGuide(importedId)
  check(!imported.health && !imported.repaired, "the sender's health results don't come along")

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll Guide me (plus) checks passed.')
  process.exitCode = failures ? 1 : 0
} finally {
  await ctx.close()
  server.close()
}
