// Guide me check. Run: npm run build && node tests/e2e-guideme.mjs [outDir]
// Records a guide on the test site, then plays it back on the live pages:
// the spotlight must land on the right element for every step, the guide must
// move on as the learner works (clicks, typing, a dropdown), carry on across a
// page change and a reload, fall back to the screenshot when a button was
// renamed, and clean up on exit.
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv[2] ?? join(root, 'tests/output'))
mkdirSync(out, { recursive: true })
const server = createServer((req, res) => {
  let body
  try {
    body = readFileSync(join(root, 'tests/site', (req.url ?? '/').split('?')[0].replace(/^\/$/, '/login.html')))
  } catch {
    return res.writeHead(404).end()
  }
  res.writeHead(200, { 'content-type': 'text/html' }).end(body)
}).listen(4178)

const ext = join(root, 'dist')
const ctx = await chromium.launchPersistentContext('', {
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
})
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
// Anonymous counts go to a stub, so tests never add to the real numbers.
await ctx.route('https://www.stepcrumb.com/api/count', (r) => r.fulfill({ status: 202, body: '{"ok":true}' }))
const extId = new URL(sw.url()).host
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (cond, msg) => {
  if (!cond) throw new Error('FAILED: ' + msg)
  console.log('ok -', msg)
}
const BASE = 'http://localhost:4178'

// The Guide me card and spotlight, read from the page.
const ui = (page) =>
  page.evaluate(() => {
    const host = document.querySelector('[data-stepcrumb-guide]')
    const r = host?.shadowRoot
    if (!r) return null
    const ring = r.querySelector('.ring')
    const rr = ring && !ring.classList.contains('hidden') ? ring.getBoundingClientRect() : null
    // What's under the middle of the spotlight (the overlay lets clicks through).
    const under = rr ? document.elementFromPoint(rr.left + rr.width / 2, rr.top + rr.height / 2) : null
    return {
      count: r.querySelector('.count')?.textContent,
      title: r.querySelector('.title')?.textContent,
      note: r.querySelector('.note:not(.hidden)')?.textContent ?? null,
      shot: !!r.querySelector('.shot:not(.hidden)')?.getAttribute('src'),
      buttons: [...r.querySelectorAll('.buttons button')].map((b) => b.textContent),
      under: under ? (under.id || under.tagName.toLowerCase()) : null,
      ring: rr && { x: rr.left, y: rr.top, w: rr.width, h: rr.height },
    }
  })
const clickCard = (page, label) =>
  page.evaluate((label) => {
    const r = document.querySelector('[data-stepcrumb-guide]').shadowRoot
    ;[...r.querySelectorAll('button')].find((b) => b.textContent === label || b.getAttribute('aria-label') === label).click()
  }, label)
const index = () => sw.evaluate(async () => (await chrome.storage.session.get('guideMe')).guideMe?.index ?? null)
// Skip ahead in a guide that has just been started (wait until it has).
async function jumpTo(i) {
  await waitFor(async () => (await index()) === 0)
  await pause(300)
  await sw.evaluate(async (i) => {
    const g = (await chrome.storage.session.get('guideMe')).guideMe
    await chrome.storage.session.set({ guideMe: { ...g, index: i } })
  }, i)
}
async function waitFor(fn, ms = 6000) {
  const end = Date.now() + ms
  for (;;) {
    const v = await fn()
    if (v || Date.now() > end) return v
    await pause(150)
  }
}

try {
  // ---- Record ----
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto(`${BASE}/login.html`)
  await pause(500)
  const st = await sw.evaluate(() => globalThis.scribe.start('Create a project in Projectly'))
  await pause(800)
  await page.click('#email'); await page.keyboard.type('sam@acme.io'); await pause(700)
  await page.click('#pw'); await page.keyboard.type('hunter2'); await pause(700)
  await page.click('text=Keep me signed in'); await pause(700)
  await page.click('button[type=submit]'); await page.waitForURL(/dashboard/); await pause(1200)
  await page.click('#new'); await pause(700)
  await page.click('#pname'); await page.keyboard.type('Website relaunch'); await pause(700)
  await page.selectOption('#ptype', { index: 1 }); await pause(700)
  await page.click('#create'); await pause(1000)
  await sw.evaluate(() => globalThis.scribe.stop(false))
  const guideId = st.guideId
  const steps = await sw.evaluate(async (id) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const g = await new Promise((r) => { const t = db.transaction('guides').objectStore('guides').get(id); t.onsuccess = () => r(t.result) })
    return g.steps.map((s) => ({ title: s.title, action: s.action, hasLocator: !!s.locator }))
  }, guideId)
  console.log('recorded:\n  ' + steps.map((s) => `${s.title} [${s.action}${s.hasLocator ? ', clues' : ''}]`).join('\n  '))
  check(steps.filter((s) => s.action !== 'navigate' && s.action !== 'key').every((s) => s.hasLocator), 'every element step saved clues for Guide me')

  // ---- Play: start from the editor's button while on another page ----
  const editor = await ctx.newPage()
  await editor.goto(`chrome-extension://${extId}/editor.html#/guide/${guideId}`)
  await editor.getByRole('button', { name: 'Guide me', exact: true }).click()
  await pause(1500)
  check(page === (await waitFor(async () => ctx.pages().find((p) => p.url().includes('localhost:4178')))), 'Guide me uses the tab already on the site')
  let u = await waitFor(() => ui(page))
  check(u && u.count === `Step 1 of ${steps.length}` && u.buttons.includes('Go to the page'), 'on the wrong page, step 1 offers "Go to the page"')
  await page.screenshot({ path: join(out, 'guideme-wrong-page.png') })
  await clickCard(page, 'Go to the page')
  await page.waitForURL(/login/)

  // Expected element for each step, by the element the step was recorded on.
  const expected = { 'Work email': 'email', Password: 'pw', 'Keep me signed in': 'remember', 'Sign in': 'button', 'New project': 'new', 'Project name': 'pname', Type: 'ptype', 'Create project': 'create' }
  let reloaded = false
  let shotSaved = false
  for (let guard = 0; guard < 20; guard++) {
    const i = await index()
    if (i === null) break
    u = await waitFor(async () => {
      const v = await ui(page)
      return v && (v.ring || v.title?.startsWith('Done') || v.note) ? v : null
    })
    if (!u) throw new Error('FAILED: no card on the page')
    if (u.title.startsWith('Done')) break
    const s = steps[i]
    const want = Object.entries(expected).find(([k]) => s.title.includes(k))?.[1]
    check(u.ring && (!want || u.under === want || (want === 'button' && u.under === 'button')), `step ${i + 1} "${s.title}": spotlight on ${u.under}`)
    if (!shotSaved && s.action === 'type') {
      await page.screenshot({ path: join(out, 'guideme-step.png') })
      shotSaved = true
    }
    // Reload once mid-guide: it must pick up at the same step.
    if (!reloaded && i === 2) {
      reloaded = true
      await page.reload()
      const again = await waitFor(() => ui(page))
      check(again && again.count === `Step ${i + 1} of ${steps.length}`, 'after a reload, the guide carries on at the same step')
      continue
    }
    const cx = u.ring.x + u.ring.w / 2
    const cy = u.ring.y + u.ring.h / 2
    if (s.action === 'type') {
      await page.mouse.click(cx, cy)
      await page.keyboard.type(s.title.includes('password') ? 'hunter2' : 'x@y.io')
      await page.keyboard.press('Tab')
    } else if (s.action === 'select') {
      await page.selectOption(`#${u.under}`, { index: 1 })
    } else {
      await page.mouse.click(cx, cy)
    }
    const moved = await waitFor(async () => (await index()) !== i)
    check(moved, `step ${i + 1} moved on after the learner did it`)
    await pause(300)
  }
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.title?.startsWith('Done') ? v : null
  })
  check(u, 'the guide ends with a "Done" card')
  await clickCard(page, 'Close')
  await pause(400)
  check((await page.locator('[data-stepcrumb-guide]').count()) === 0 && (await index()) === null, 'closing removes the overlay and stops the guide')

  // ---- A step on another page: offer to go there ----
  await page.goto(`${BASE}/dashboard.html`)
  await editor.bringToFront()
  await editor.getByRole('button', { name: 'Guide me', exact: true }).click()
  await page.bringToFront()
  const emailIdx = steps.findIndex((s) => s.title.includes('Work email'))
  await jumpTo(emailIdx)
  await page.reload()
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.note ? v : null
  }, 9000)
  check(u && /another page/.test(u.note) && u.buttons.includes('Go to the page'), 'a step on another page offers "Go to the page"')
  await clickCard(page, 'Exit Guide me')
  await pause(300)

  // ---- Played on another site than it was recorded on (e.g. live vs test) ----
  await editor.bringToFront()
  await editor.getByRole('button', { name: 'Guide me', exact: true }).click()
  await page.bringToFront()
  await waitFor(async () => (await index()) === 0)
  await page.goto('http://127.0.0.1:4178/login.html')
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.note && /recorded on/.test(v.note) ? v : null
  })
  check(u && u.note.includes('localhost:4178') && u.buttons.includes('Stay here'), 'on another site, it says where the guide was recorded and offers "Stay here"')
  await clickCard(page, 'Stay here')
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.ring ? v : null
  })
  check(u?.under === 'email', '"Stay here" plays the guide on this site')
  await clickCard(page, 'Exit Guide me')
  await pause(300)

  // ---- A renamed button: show the screenshot instead of guessing ----
  // Rename "New project" as the dashboard loads, before Guide me looks for it.
  await page.addInitScript(() =>
    document.addEventListener('DOMContentLoaded', () => {
      const b = document.getElementById('new')
      if (b) {
        b.textContent = 'Add something'
        b.id = 'add'
      }
    }),
  )
  await page.goto(`${BASE}/login.html`)
  await editor.bringToFront()
  await editor.getByRole('button', { name: 'Guide me', exact: true }).click()
  await page.bringToFront()
  const newIdx = steps.findIndex((s) => s.title.includes('New project'))
  await jumpTo(newIdx)
  await page.goto(`${BASE}/dashboard.html`)
  u = await waitFor(async () => {
    const v = await ui(page)
    return v?.note && v.shot ? v : null
  }, 9000)
  check(u && u.title.includes('New project') && /can't find/.test(u.note) && u.shot && u.buttons.includes("I've done this"), 'renamed button: shows the screenshot and "I\'ve done this" instead of guessing')
  await page.screenshot({ path: join(out, 'guideme-fallback.png') })
  await clickCard(page, 'Exit Guide me')
  await pause(300)
  check((await index()) === null, 'Exit stops the guide')
  console.log('\nAll Guide me checks passed.')
} finally {
  await ctx.close()
  server.close()
}
