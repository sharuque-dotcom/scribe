// Editing an SOP like a normal document: type, bold, add a Tip, insert and
// remove screenshots, edit a table cell, undo, and the edits survive a reload
// and reach the saved document (which every export is made from).
// Run: npm run build && node tests/e2e-doc.mjs
import { chromium } from 'playwright-core'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const ext = join(root, 'dist')
const ctx = await chromium.launchPersistentContext('', { executablePath: process.env.CHROMIUM_PATH, headless: true, viewport: { width: 1440, height: 900 }, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] })
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))
// Anonymous counts go to a stub, so tests never add to the real numbers.
await ctx.route('https://www.stepcrumb.com/api/count', (r) => r.fulfill({ status: 202, body: '{"ok":true}' }))
const id = new URL(sw.url()).host
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (cond, msg) => {
  if (!cond) failures++
  console.log(cond ? 'ok  ' : 'FAIL', '-', msg)
}
const savedSop = (guideId) =>
  sw.evaluate(async (guideId) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const g = await new Promise((r) => { const t = db.transaction('guides').objectStore('guides').get(guideId); t.onsuccess = () => r(t.result) })
    return g.docs.sop?.markdown ?? ''
  }, guideId)

try {
  const p = ctx.pages()[0] ?? (await ctx.newPage())
  const errors = []
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('dialog', (d) => d.accept())
  await p.goto(`chrome-extension://${id}/editor.html`)
  await p.getByRole('button', { name: 'Open a sample' }).click()
  await p.waitForURL(/#\/guide\//)
  const guideId = p.url().split('#/guide/')[1].split('/')[0]
  await p.goto(`chrome-extension://${id}/editor.html#/guide/${guideId}/sop`)
  await p.getByRole('button', { name: /Create from steps|Use template/ }).click()
  const doc = p.locator('.doc-prose')
  await doc.waitFor()
  await pause(800)
  check((await p.locator('textarea[aria-label="Document markdown"]').count()) === 0, 'no Markdown box: the document opens ready to edit')
  const shotsBefore = await p.locator('.doc-shot').count()
  check(shotsBefore > 1, `screenshots show as pictures (${shotsBefore})`)

  // Type at the end of the Purpose paragraph, then make a word bold.
  const purpose = doc.locator('h2', { hasText: 'Purpose' }).locator('xpath=following-sibling::p[1]')
  await purpose.click()
  await p.keyboard.press('End')
  await p.keyboard.type(' Only trained staff should do this.')
  // Select the word "this" (just before the full stop).
  await p.keyboard.press('ArrowLeft')
  for (let i = 0; i < 'this'.length; i++) await p.keyboard.press('Shift+ArrowLeft')
  await p.getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name: 'Bold' }).click()
  await pause(200)
  check((await purpose.locator('strong', { hasText: 'this' }).count()) === 1, 'selected text is made bold from the toolbar')

  // Add a Warning from the Insert menu and write in it.
  await p.keyboard.press('End')
  await p.getByRole('button', { name: 'Insert', exact: true }).click()
  await p.getByRole('menuitem', { name: /^Warning/ }).click()
  await p.keyboard.type('Check the record is not a duplicate.')
  check((await doc.locator('.callout[data-kind="Warning"]', { hasText: 'not a duplicate' }).count()) === 1, 'a Warning box is added from the Insert menu')

  // Insert step 3's screenshot from the picker.
  await p.keyboard.press('Enter')
  await p.getByRole('button', { name: 'Insert', exact: true }).click()
  await p.getByRole('menuitem', { name: /^Screenshot/ }).click()
  await p.getByRole('dialog', { name: 'Choose a screenshot' }).getByRole('button', { name: /Step 3/ }).click()
  await pause(300)
  check((await p.locator('.doc-shot').count()) === shotsBefore + 1, 'a screenshot is inserted from the picker')

  // Remove the last screenshot.
  const last = p.locator('.doc-shot').last()
  await last.scrollIntoViewIfNeeded()
  await last.hover()
  await last.getByRole('button', { name: 'Remove screenshot' }).click()
  await pause(300)
  check((await p.locator('.doc-shot').count()) === shotsBefore, 'a screenshot is removed with one click')

  // Fill in the Owner cell: clicking the highlighted blank selects it, typing replaces it.
  check((await doc.locator('.fill-in').count()) >= 1, 'template blanks are highlighted to fill in')
  const owner = doc.locator('td', { hasText: 'Add owner' })
  await owner.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await owner.locator('.fill-in').click()
  await pause(150)
  await p.keyboard.type('Sam Lee')
  await pause(150)
  check((await doc.locator('td', { hasText: 'Sam Lee' }).count()) === 1 && (await doc.locator('td em', { hasText: 'Sam Lee' }).count()) === 0, 'a blank is filled in by clicking it and typing (plain text)')
  check((await doc.locator('.fill-in').count()) === 0, 'no blanks left to fill in')

  // Undo the last change, then redo it.
  await p.keyboard.press('Control+z')
  await pause(200)
  const afterUndo = await doc.locator('td', { hasText: 'Sam Lee' }).count()
  await p.keyboard.press('Control+Shift+z')
  await pause(200)
  check(afterUndo === 0 && (await doc.locator('td', { hasText: 'Sam Lee' }).count()) === 1, 'Undo and Redo work')

  // Saved, survives a reload, and is in the document every export is made from.
  await pause(900)
  check((await p.getByText('Saved', { exact: true }).count()) === 1, 'shows Saved')
  await p.reload()
  await doc.waitFor()
  await pause(800)
  check((await doc.locator('.callout[data-kind="Warning"]', { hasText: 'not a duplicate' }).count()) === 1 && (await doc.locator('td', { hasText: 'Sam Lee' }).count()) === 1, 'edits are still there after a reload')
  const md = await savedSop(guideId)
  if (process.env.DEBUG) console.log('SAVED:\n' + md.slice(0, 1600))
  check(md.includes('Only trained staff should do **this**.'), 'the saved document has the bold text')
  check(md.includes('> **Warning:** Check the record is not a duplicate.'), 'the saved document has the Warning')
  check(md.includes('Sam Lee') && !md.includes('Add owner'), 'the saved document has the filled-in owner')
  check((md.match(/\{\{screenshot:\d+\}\}/g) ?? []).length === shotsBefore, 'the saved document keeps its screenshots')

  // Markdown is still there for those who want it.
  await p.getByRole('button', { name: 'More' }).click()
  await p.getByRole('button', { name: /Edit as Markdown/ }).click()
  check((await p.locator('textarea[aria-label="Document markdown"]').inputValue()).includes('Sam Lee'), 'More → Edit as Markdown shows the same document')
  await p.screenshot({ path: join(root, 'tests/output/doc-markdown.png') })
  check(errors.length === 0, `no page errors ${errors.join(' | ')}`)

  console.log(failures ? `\n${failures} check(s) failed.` : '\nAll document editor checks passed.')
  process.exitCode = failures ? 1 : 0
} finally {
  await ctx.close()
}
