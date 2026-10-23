// Turns guides and documents into shareable HTML, Markdown, PDF (via print) and JSON.
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { getImages, putGuide, putImage } from './db'
import { guideViews } from './zoom'
import { renderStep } from './render'
import { stepNumbers } from './templates'
import type { Guide, StoredImage } from './types'
import { uid } from './types'

export type Rendered = Record<string, string> // stepId -> flattened image data URL

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// Renders every step's screenshot as readers see it (zoomed where the guide's
// zoom rules say so). `full: true` gives whole-screen images instead, which is
// what Claude gets so it can see the full page.
export async function renderAll(
  guide: Guide,
  images: Record<string, StoredImage>,
  maxWidth = 1400,
  opts: { full?: boolean } = {},
): Promise<Rendered> {
  const views = guideViews(guide, images)
  const out: Rendered = {}
  await Promise.all(
    guide.steps.map(async (s) => {
      const img = s.imageId ? images[s.imageId] : undefined
      if (!img) return
      const view = opts.full ? { inset: false } : views.get(s.id)
      out[s.id] = await renderStep(s, img, { maxWidth, view })
    }),
  )
  return out
}

// Map "Step N" numbers to rendered screenshots, for document placeholders.
export function shotsByNumber(guide: Guide, rendered: Rendered): Record<number, string> {
  const out: Record<number, string> = {}
  for (const [id, n] of stepNumbers(guide)) if (rendered[id]) out[n] = rendered[id]
  return out
}

const SHOT_LINE = /^[ \t]*\{\{\s*screenshot\s*:\s*(\d+)\s*\}\}[ \t]*$/gim

export function markdownToHtml(md: string, shots: Record<number, string>): string {
  const withShots = md.replace(SHOT_LINE, (_m, n: string) => {
    const src = shots[Number(n)]
    return src ? `\n<figure class="shot"><img src="${src}" alt="Screenshot for step ${n}"></figure>\n` : ''
  })
  const html = marked.parse(withShots, { async: false, gfm: true }) as string
  return DOMPurify.sanitize(html, { ADD_TAGS: ['details', 'summary', 'figure'] })
}

export function markdownWithImages(md: string, shots: Record<number, string>): string {
  return md.replace(SHOT_LINE, (_m, n: string) => (shots[Number(n)] ? `![Step ${n}](${shots[Number(n)]})` : ''))
}

// ---------- guide (step-by-step) ----------

export function guideBodyHtml(guide: Guide, rendered: Rendered): string {
  const nums = stepNumbers(guide)
  const parts: string[] = [`<h1>${escapeHtml(guide.title)}</h1>`]
  if (guide.description) parts.push(`<p class="lead">${escapeHtml(guide.description)}</p>`)
  const count = nums.size
  parts.push(`<p class="meta">${count} step${count === 1 ? '' : 's'}</p>`)
  for (const s of guide.steps) {
    if (s.kind === 'heading') {
      parts.push(`<h2>${escapeHtml(s.title)}</h2>`)
    } else if (s.kind === 'note') {
      parts.push(
        `<div class="note note-${s.noteStyle ?? 'info'}"><strong>${escapeHtml(s.title)}</strong>${
          s.detail ? `<p>${escapeHtml(s.detail)}</p>` : ''
        }</div>`,
      )
    } else {
      const n = nums.get(s.id)
      parts.push(
        `<section class="step"><div class="step-head"><span class="num">${n}</span><div><p class="step-title">${escapeHtml(
          s.title,
        )}</p>${s.detail ? `<p class="step-detail">${escapeHtml(s.detail)}</p>` : ''}</div></div>${
          rendered[s.id] ? `<figure class="shot"><img src="${rendered[s.id]}" alt="Step ${n}"></figure>` : ''
        }</section>`,
      )
    }
  }
  return parts.join('\n')
}

export function guideMarkdown(guide: Guide, rendered: Rendered): string {
  const nums = stepNumbers(guide)
  const out: string[] = [`# ${guide.title}`]
  if (guide.description) out.push(guide.description)
  for (const s of guide.steps) {
    if (s.kind === 'heading') out.push(`## ${s.title}`)
    else if (s.kind === 'note') out.push(`> **${s.title}**${s.detail ? ` ${s.detail}` : ''}`)
    else {
      const n = nums.get(s.id)
      out.push(`**${n}. ${s.title}**` + (s.detail ? `\n\n${s.detail}` : ''))
      if (rendered[s.id]) out.push(`![Step ${n}](${rendered[s.id]})`)
    }
  }
  return out.join('\n\n') + '\n'
}

export const DOC_CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.6 Inter,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:880px;margin:0 auto;padding:48px 24px 80px;background:#fff;min-height:100vh}
h1{font-size:30px;line-height:1.2;margin:0 0 12px}
h2{font-size:21px;margin:36px 0 12px;padding-top:8px;border-top:1px solid #e2e8f0}
h3{font-size:17px;margin:28px 0 8px}
.lead{font-size:17px;color:#334155;margin:0 0 4px}
.meta{color:#64748b;font-size:14px;margin:0 0 24px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:14px}
th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left;vertical-align:top}
th{background:#f1f5f9}
blockquote{margin:16px 0;padding:10px 14px;border-left:4px solid #3b82f6;background:#eff6ff;border-radius:6px}
blockquote p{margin:0}
figure.shot{margin:12px 0 24px}
figure.shot img{display:block;max-width:100%;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 16px -8px rgba(15,23,42,.25)}
.step{margin:22px 0 30px;break-inside:avoid}
.step-head{display:flex;gap:12px;align-items:flex-start}
.num{flex:none;width:30px;height:30px;border-radius:50%;background:#f97316;color:#fff;font-weight:700;display:grid;place-items:center;font-size:14px;margin-top:1px}
.step-title{margin:2px 0 0;font-weight:600;font-size:17px}
.step-detail{margin:4px 0 0;color:#475569}
.note{margin:18px 0;padding:12px 16px;border-radius:8px;background:#eff6ff;border-left:4px solid #3b82f6}
.note p{margin:4px 0 0}
.note-tip{background:#f0fdf4;border-color:#22c55e}
.note-warning{background:#fffbeb;border-color:#f59e0b}
details{margin:12px 0;padding:10px 14px;background:#f8fafc;border-radius:8px}
summary{cursor:pointer;font-weight:600}
code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:.9em}
@media print{body{background:#fff}main{padding:0;max-width:none}figure.shot img{box-shadow:none}h2{break-after:avoid}}
`

export function wrapHtml(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    title,
  )}</title><style>${DOC_CSS}</style></head><body><main>${body}</main></body></html>`
}

// ---------- files ----------

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'guide'
  )
}

export function download(filename: string, content: string | Blob, mime = 'text/plain') {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// Prints through a hidden frame, so the browser's "Save as PDF" gives a clean document.
export function printHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  frame.srcdoc = html
  frame.onload = () => {
    const w = frame.contentWindow!
    const imgs = Array.from(w.document.images)
    Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r))))).then(() => {
      w.focus()
      w.print()
      setTimeout(() => frame.remove(), 60_000)
    })
  }
  document.body.appendChild(frame)
}

// ---------- JSON backup ----------

interface GuideFile {
  format: 'scribe-guide'
  version: 1
  guide: Guide
  images: StoredImage[]
}

export async function guideJson(guide: Guide): Promise<string> {
  const ids = guide.steps.map((s) => s.imageId).filter((x): x is string => !!x)
  const images = Object.values(await getImages(ids))
  const file: GuideFile = { format: 'scribe-guide', version: 1, guide, images }
  return JSON.stringify(file)
}

// Imports with fresh IDs so the same file can be imported more than once.
export async function importGuideJson(text: string): Promise<Guide> {
  const file = JSON.parse(text) as GuideFile
  if (file?.format !== 'scribe-guide' || !file.guide || !Array.isArray(file.guide.steps)) {
    throw new Error('This file is not a Scribe guide export.')
  }
  const idMap = new Map<string, string>()
  for (const img of file.images ?? []) {
    const id = uid()
    idMap.set(img.id, id)
    await putImage({ ...img, id })
  }
  const now = Date.now()
  const guide: Guide = {
    ...file.guide,
    id: uid(),
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    docs: file.guide.docs ?? {},
    steps: file.guide.steps.map((s) => ({
      ...s,
      id: uid(),
      annotations: s.annotations ?? [],
      imageId: s.imageId ? idMap.get(s.imageId) : undefined,
    })),
  }
  await putGuide(guide)
  return guide
}
