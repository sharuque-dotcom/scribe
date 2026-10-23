// Renders the extension icon SVG to PNGs. Run once: node scripts/make-icons.mjs
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#4f46e5"/>
  <rect x="30" y="24" width="60" height="78" rx="9" fill="#fff"/>
  <rect x="41" y="40" width="38" height="6" rx="3" fill="#c7d2fe"/>
  <rect x="41" y="54" width="30" height="6" rx="3" fill="#c7d2fe"/>
  <rect x="41" y="68" width="34" height="6" rx="3" fill="#c7d2fe"/>
  <circle cx="88" cy="88" r="20" fill="#f97316" stroke="#4f46e5" stroke-width="6"/>
  <path d="M83 79l14 8-6 2-2 6z" fill="#fff"/>
</svg>`

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage()
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
  writeFileSync(`public/icons/icon${size}.png`, await page.screenshot({ omitBackground: true }))
}
await browser.close()
