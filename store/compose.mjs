// Builds the Chrome Web Store images from the raw screens made by capture.mjs:
// five 1280×800 screenshots with headlines, a 440×280 small promo tile and a
// 1400×560 marquee. Usage: CHROMIUM_PATH=... node store/compose.mjs <rawDir> [outDir]
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const raw = resolve(process.argv[2] ?? join(root, 'store/raw'))
const out = resolve(process.argv[3] ?? join(root, 'store/assets'))
mkdirSync(out, { recursive: true })
const img = (name) => pathToFileURL(join(raw, name)).href

const BG = {
  violet: 'radial-gradient(60% 70% at 15% 10%, #c4b5fd 0, transparent 60%), radial-gradient(50% 60% at 90% 20%, #a5b4fc 0, transparent 60%), radial-gradient(60% 70% at 60% 100%, #f0abfc 0, transparent 60%), #6366f1',
  sky: 'radial-gradient(55% 65% at 15% 15%, #93c5fd 0, transparent 60%), radial-gradient(50% 60% at 85% 20%, #e0f2fe 0, transparent 60%), radial-gradient(60% 70% at 55% 100%, #60a5fa 0, transparent 60%), #3b82f6',
  dusk: 'radial-gradient(55% 65% at 20% 15%, #fdba74 0, transparent 60%), radial-gradient(50% 60% at 85% 20%, #f9a8d4 0, transparent 60%), radial-gradient(60% 70% at 55% 100%, #c084fc 0, transparent 60%), #fb7185',
  meadow: 'radial-gradient(55% 65% at 20% 15%, #4ade80 0, transparent 60%), radial-gradient(50% 60% at 85% 20%, #2dd4bf 0, transparent 60%), radial-gradient(60% 70% at 55% 100%, #34d399 0, transparent 60%), #059669',
  ink: 'radial-gradient(55% 65% at 20% 15%, #4338ca 0, transparent 60%), radial-gradient(50% 60% at 85% 25%, #1e3a8a 0, transparent 60%), radial-gradient(60% 70% at 55% 100%, #6d28d9 0, transparent 60%), #0f172a',
}

const MARK = `<svg viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" rx="16" fill="#151412"/><circle cx="18" cy="44" r="6" fill="#F97316"/><circle cx="32" cy="32" r="7.5" fill="#FAF8F4"/><circle cx="46" cy="18" r="9" fill="#818CF8"/></svg>`

const page = (w, h, bg, body) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0}html,body{width:${w}px;height:${h}px;overflow:hidden}
body{font-family:Inter,system-ui,sans-serif;background:${bg};color:#fff;position:relative;-webkit-font-smoothing:antialiased}
.h{font-weight:800;letter-spacing:-.035em;line-height:1.05;text-shadow:0 2px 18px rgba(15,23,42,.28)}.s{font-weight:600;text-shadow:0 1px 10px rgba(15,23,42,.35)}
.win{position:absolute;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 30px 80px rgba(15,23,42,.35),0 0 0 1px rgba(255,255,255,.4)}
.bar{height:30px;background:#f3f4f6;display:flex;align-items:center;gap:7px;padding:0 12px;border-bottom:1px solid #e5e7eb}
.bar i{width:10px;height:10px;border-radius:50%;display:block}.win img{display:block;width:100%}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:-.02em}
</style></head><body>${body}</body></html>`

const bar = `<div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>`

const SHOTS = [
  { file: '1-guide', bg: BG.violet, h: 'Click through once. Get the guide.', s: 'Every click becomes a step with a zoomed, highlighted screenshot.', img: '1-guide.png' },
  { file: '2-blur', bg: BG.dusk, h: 'Card numbers and passwords, blurred.', s: 'Secret fields are pixelated before anything is saved.', img: '2-blur.png' },
  { file: '3-sop', bg: BG.sky, h: 'SOPs and training from your steps.', s: 'Purpose, scope, procedure and a quiz. Export to PDF or Word.', img: '3-sop.png' },
  { file: '4-video', bg: BG.meadow, h: 'A narrated video with auto-zoom.', s: 'Captions, smooth cursor and a free voiceover, made on your computer.', img: '4-video.png' },
  { file: '5-private', bg: BG.ink, h: 'No account. Nothing uploaded.', s: 'Screenshots, guides and videos stay on your computer.', img: '5-library.png', popup: '5-popup.png' },
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
async function render(html, w, h, name) {
  const file = join(out, `.${name}.html`)
  writeFileSync(file, html)
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await p.goto(pathToFileURL(file).href)
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(400)
  await p.screenshot({ path: join(out, `${name}.png`) })
  await p.close()
  ;(await import('node:fs')).unlinkSync(file)
}

for (const [i, s] of SHOTS.entries()) {
  const popup = s.popup
    ? `<div class="win" style="right:70px;top:250px;width:300px;height:326px;border-radius:14px"><img src="${img(s.popup)}"></div>`
    : ''
  const body = `
    <div style="position:absolute;left:0;right:0;top:46px;text-align:center">
      <div class="h" style="font-size:48px">${s.h}</div>
      <div class="s" style="font-size:21px;margin-top:12px">${s.s}</div>
    </div>
    <div class="win" style="left:100px;right:100px;top:190px;height:640px">${bar}<img src="${img(s.img)}"></div>
    ${popup}`
  await render(page(1280, 800, s.bg, body), 1280, 800, `screenshot-${i + 1}-${s.file.split('-').slice(1).join('-')}`)
}

// Small promo tile (440×280).
await render(
  page(440, 280, BG.violet, `
    <div style="position:absolute;inset:0;padding:34px 32px;display:flex;flex-direction:column;justify-content:center">
      <div class="logo" style="font-size:30px"><span style="width:46px;height:46px;display:block">${MARK}</span>StepCrumb</div>
      <div class="h" style="font-size:27px;margin-top:20px">Click once. Get the guide,<br>SOP and video.</div>
      <div class="s" style="font-size:14px;margin-top:12px">Private: everything stays on your computer.</div>
    </div>`),
  440, 280, 'promo-small-440x280',
)

// Marquee (1400×560).
await render(
  page(1400, 560, BG.violet, `
    <div style="position:absolute;left:80px;top:0;bottom:0;width:520px;display:flex;flex-direction:column;justify-content:center">
      <div class="logo" style="font-size:34px"><span style="width:52px;height:52px;display:block">${MARK}</span>StepCrumb</div>
      <div class="h" style="font-size:50px;margin-top:26px">Show it once.<br>Explain it forever.</div>
      <div class="s" style="font-size:20px;margin-top:18px">Step-by-step guides, SOPs, training and narrated videos from one click-through.</div>
    </div>
    <div class="win" style="left:660px;top:110px;width:680px;height:470px">${bar}<img src="${img('1-guide.png')}"></div>`),
  1400, 560, 'marquee-1400x560',
)
await browser.close()
console.log('Store images saved to', out)
