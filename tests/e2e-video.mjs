// Video end-to-end check: records the test site's sign-in + project flow with
// video on, then checks the recording, the Video tab, voice and export.
// Usage: npm run build && CHROMIUM_PATH=/path/to/chrome node tests/e2e-video.mjs [outDir] [--no-voice]
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { activateInSettings, fakeLicenseServer } from './license-helper.mjs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const out = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? join(root, 'tests/output'))
const withVoice = !process.argv.includes('--no-voice')
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
}).listen(4174)

const launch = (extra = []) =>
  chromium.launchPersistentContext('', {
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, ...extra],
  })
const workerOf = async (ctx) => ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'))

// Tab capture normally needs a click on the extension button. For automated
// runs, Chromium lets an allowlisted extension skip that.
let ctx = await launch()
const extId = new URL((await workerOf(ctx)).url()).host
await ctx.close()
ctx = await launch([`--allowlisted-extension-id=${extId}`])
const sw = await workerOf(ctx)
await fakeLicenseServer(ctx)

// Moves the mouse in steps, like a person, so there's a cursor path to follow.
async function moveTo(page, selector) {
  const box = await page.locator(selector).boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 })
}
async function clickOn(page, selector) {
  await moveTo(page, selector)
  await pause(150)
  await page.click(selector)
}

try {
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto('http://localhost:4174/login.html')
  await page.mouse.move(640, 400)
  await pause(400)
  await page.bringToFront()
  const st = await sw.evaluate(() => globalThis.scribe.start('Create a project (video)', { video: true, source: 'tab' }))
  check(st.recording && st.video, 'recording started with video')
  check((await page.locator('div[style*="2147483647"]').count()) === 0, 'no control bar on the page while recording video')
  await pause(600)

  await clickOn(page, '#email'); await page.keyboard.type('sam@acme.io', { delay: 40 }); await pause(500)
  await clickOn(page, '#pw'); await page.keyboard.type('hunter2', { delay: 40 }); await pause(500)
  await clickOn(page, 'text=Keep me signed in'); await pause(600)
  await clickOn(page, 'button[type=submit]'); await page.waitForURL(/dashboard/); await pause(1200)
  await page.mouse.move(640, 400, { steps: 8 })
  await clickOn(page, '#new'); await pause(700)
  await clickOn(page, '#pname'); await page.keyboard.type('Q3 launch', { delay: 40 }); await pause(500)
  await clickOn(page, '#ptype'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await pause(600)
  await clickOn(page, '#create'); await pause(1500)

  const editorPromise = ctx.waitForEvent('page')
  await sw.evaluate(() => globalThis.scribe.stop(true))
  const editor = await editorPromise
  await editor.waitForLoadState()
  await editor.setViewportSize({ width: 1440, height: 900 })
  const guideId = new URL(editor.url()).hash.split('/')[2]

  const info = await editor.evaluate(async (id) => {
    const db = await new Promise((r) => { const q = indexedDB.open('scribe'); q.onsuccess = () => r(q.result) })
    const get = (store, key) => new Promise((r) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => r(q.result) })
    const g = await get('guides', id)
    const v = g.video ? await get('videos', g.video.blobId) : null
    return {
      steps: g.steps.map((s) => ({ title: s.title, time: s.time })),
      video: g.video && { duration: g.video.duration, w: g.video.w, h: g.video.h, cursor: g.video.cursor.length, redact: g.video.redact.length },
      bytes: v?.blob.size ?? 0,
    }
  }, guideId)
  console.log('video:', JSON.stringify(info.video), 'bytes:', info.bytes)
  console.log('steps:\n  ' + info.steps.map((s) => `${(s.time / 1000).toFixed(1)}s  ${s.title}`).join('\n  '))
  check(info.video && info.video.duration > 8000 && info.bytes > 20000, 'video saved with a duration')
  check(info.video.w > 0 && info.video.h > 0, 'video size recorded')
  check(info.video.cursor > 50, 'mouse path recorded')
  check(info.steps.every((s, i) => typeof s.time === 'number' && (i === 0 || s.time >= info.steps[i - 1].time)), 'every step has a time, in order')
  check(info.steps[0].time < 1000 && info.steps.at(-1).time < info.video.duration, 'step times fall inside the video')
  writeFileSync(join(out, 'video-info.json'), JSON.stringify(info, null, 2))
  // ---------- Video tab ----------
  await editor.goto(editor.url() + '/video')
  await editor.waitForSelector('canvas[aria-label="Video preview"]')
  await pause(1500)
  const zoomBlocks = await editor.locator('[title="Zoom"]').count()
  check(zoomBlocks >= 2, `auto-zoom blocks on the timeline (${zoomBlocks})`)
  // Jump to the "Check Keep me signed in" step: zoomed in, with cursor and caption.
  await editor.getByTitle('Jump here').nth(3).click()
  await pause(1200)
  await editor.locator('canvas[aria-label="Video preview"]').screenshot({ path: join(out, 'v1-preview-click.png') })
  await editor.getByTitle('Jump here').nth(0).click()
  await pause(800)
  await editor.locator('canvas[aria-label="Video preview"]').screenshot({ path: join(out, 'v0-preview-start.png') })
  await editor.evaluate(() => window.scrollTo(0, 0))
  await editor.screenshot({ path: join(out, 'v3-video-tab-top.png') })

  // Play advances the preview.
  const timeText = () => editor.locator('span.tabular-nums').first().textContent()
  await editor.getByTitle('Jump here').nth(0).click()
  const before = await timeText()
  await editor.getByRole('button', { name: 'Play' }).click()
  await pause(1500)
  await editor.getByRole('button', { name: 'Pause' }).click()
  const after = await timeText()
  console.log(`   play: ${before} -> ${after}`)
  check(before !== after, 'Play moves the preview forward')

  // Add a zoom at the playhead, then delete it.
  const zoomsBefore = await editor.locator('[title="Zoom"]').count()
  await editor.getByRole('button', { name: '+ Add zoom here' }).click()
  check((await editor.locator('[title="Zoom"]').count()) === zoomsBefore + 1, 'a zoom can be added')
  await editor.getByRole('button', { name: 'Delete zoom' }).click()
  check((await editor.locator('[title="Zoom"]').count()) === zoomsBefore, 'a zoom can be deleted')

  // Narration override changes the caption text.
  await editor.getByLabel('Narration for step 5').fill('Now sign in.')
  await pause(400)

  if (withVoice) {
    const t0 = Date.now()
    await editor.getByRole('button', { name: /Generate voiceover/ }).click()
    await editor.getByRole('button', { name: 'Voice is up to date' }).waitFor({ timeout: 600_000 })
    console.log(`   voice generated in ${Math.round((Date.now() - t0) / 1000)}s`)
    check(true, 'free voiceover generated for every line')
  }

  // Subtitles.
  const vttDl = editor.waitForEvent('download')
  await editor.getByRole('button', { name: '.vtt' }).click()
  const vtt = readFileSync(await (await vttDl).path(), 'utf8')
  check(vtt.startsWith('WEBVTT') && vtt.includes('Type "sam@acme.io" into the "Work email" field') && vtt.includes('Now sign in.'), 'subtitle file has the captions and narration override')

  // ---------- Free plan ----------
  const disabledVoices = await editor.locator('select[aria-label="Voice"] option[disabled]').count()
  check(disabledVoices === 5, 'free plan: 1 voice included, 5 locked')
  await editor.getByRole('button', { name: 'Background Dark' }).click()
  await editor.getByText('More backgrounds is included with a StepCrumb license.').waitFor()
  check(true, 'free plan: extra backgrounds are locked')
  await editor.locator('canvas[aria-label="Video preview"]').screenshot({ path: join(out, 'v4-free-preview.png') })

  const { Input, BufferSource, ALL_FORMATS } = await import('mediabunny')
  async function exportAndRead(label, buttonName) {
    const t = Date.now()
    const done = editor.waitForEvent('download', { timeout: 600_000 })
    await editor.getByRole('button', { name: buttonName, exact: true }).click()
    const dl = await done
    const file = join(out, `${label}-${dl.suggestedFilename()}`)
    await dl.saveAs(file)
    const input = new Input({ source: new BufferSource(readFileSync(file)), formats: ALL_FORMATS })
    const vt = await input.getPrimaryVideoTrack()
    const at = await input.getPrimaryAudioTrack()
    const dur = await input.computeDuration()
    console.log(`   ${label}: ${dl.suggestedFilename()} ${vt.displayWidth}x${vt.displayHeight} ${await vt.getCodec()}, audio: ${at ? await at.getCodec() : 'none'}, ${dur.toFixed(1)}s, ${Math.round((Date.now() - t) / 1000)}s to export`)
    return { vt, at, dur }
  }

  const free = await exportAndRead('free', 'Export video (720p)')
  check(free.vt.displayWidth === 1280 && free.vt.displayHeight === 720, 'free plan: video exports at 720p')
  if (withVoice) check(!!free.at, 'free plan: voiceover included with the free voice')

  // ---------- Paid plan ----------
  await activateInSettings(editor, check)
  check((await editor.locator('select[aria-label="Voice"] option[disabled]').count()) === 0, 'paid plan: all 6 voices unlocked')
  await editor.getByRole('button', { name: 'Background Dark' }).click()
  await pause(500)
  await editor.locator('canvas[aria-label="Video preview"]').screenshot({ path: join(out, 'v5-paid-preview.png') })
  await editor.getByRole('button', { name: 'Background Gradient' }).click()
  const paid = await exportAndRead('paid', 'Export video')
  check(paid.vt.displayWidth === 1920 && paid.vt.displayHeight === 1080, 'paid plan: video exports at 1080p')
  check(paid.dur * 1000 > info.video.duration - 500, 'exported video is at least as long as the recording')
  if (withVoice) check(!!paid.at, 'exported video has the voiceover audio track')
  await editor.screenshot({ path: join(out, 'v2-video-tab.png'), fullPage: true })
  console.log('\nAll video checks passed. Output in', out)
} finally {
  await ctx.close()
  server.close()
}
