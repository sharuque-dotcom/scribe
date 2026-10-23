// Draws a step's screenshot with its crop, redactions, click highlight and
// annotations baked in. Used for the editor cards, previews, exports and AI input.
import type { Annotation, NRect, Step, StoredImage } from './types'

export const COLORS = ['#f97316', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#111827', '#ffffff']
export const HIGHLIGHT = '#f97316'

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
    imageCache.set(src, p)
    if (imageCache.size > 200) imageCache.delete(imageCache.keys().next().value!)
  }
  return p
}

export function normRect(a: { x1: number; y1: number; x2: number; y2: number }): NRect {
  return { x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2), w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1) }
}

export const FULL: NRect = { x: 0, y: 0, w: 1, h: 1 }

// The click highlight box: the clicked element, or a circle around the click
// point when the element is too large to be a useful highlight.
export function autoHighlight(step: Step): { kind: 'rect'; rect: NRect } | { kind: 'circle'; x: number; y: number } | null {
  if (step.showAutoHighlight === false) return null
  const r = step.targetRect
  if (r && r.w * r.h < 0.25 && r.w > 0 && r.h > 0) {
    const pad = 0.006
    return { kind: 'rect', rect: { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 } }
  }
  if (step.click) return { kind: 'circle', ...step.click }
  return null
}

interface RenderOpts {
  maxWidth?: number
  type?: 'image/jpeg' | 'image/png'
  quality?: number
}

export async function renderStep(step: Step, image: StoredImage, opts: RenderOpts = {}): Promise<string> {
  const img = await loadImage(image.dataUrl)
  const canvas = drawStep(step, img, opts.maxWidth ?? 1600)
  return canvas.toDataURL(opts.type ?? 'image/jpeg', opts.quality ?? 0.9)
}

export function drawStep(step: Step, img: HTMLImageElement, maxWidth: number): HTMLCanvasElement {
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  const crop = step.crop ?? FULL
  const sw = crop.w * iw
  const sh = crop.h * ih
  const scale = Math.min(1, maxWidth / sw)
  const cw = Math.max(1, Math.round(sw * scale))
  const ch = Math.max(1, Math.round(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, crop.x * iw, crop.y * ih, sw, sh, 0, 0, cw, ch)

  // Map normalized full-image coordinates into this canvas.
  const X = (x: number) => ((x - crop.x) / crop.w) * cw
  const Y = (y: number) => ((y - crop.y) / crop.h) * ch
  const unit = Math.max(2, cw / 450)

  const blurs = step.annotations.filter((a) => a.type === 'blur')
  for (const a of blurs) pixelate(ctx, canvas, normRect(a), X, Y)

  const spot = step.annotations.find((a) => a.type === 'spotlight')
  if (spot) {
    const r = normRect(spot)
    ctx.save()
    ctx.fillStyle = 'rgba(15,23,42,0.55)'
    ctx.beginPath()
    ctx.rect(0, 0, cw, ch)
    roundRectPath(ctx, X(r.x), Y(r.y), X(r.x + r.w) - X(r.x), Y(r.y + r.h) - Y(r.y), unit * 2)
    ctx.fill('evenodd')
    ctx.restore()
  }

  const hl = autoHighlight(step)
  if (hl?.kind === 'rect') {
    const { x, y, w, h } = hl.rect
    ctx.save()
    ctx.fillStyle = 'rgba(249,115,22,0.12)'
    ctx.strokeStyle = HIGHLIGHT
    ctx.lineWidth = unit * 1.4
    roundRectPath(ctx, X(x), Y(y), X(x + w) - X(x), Y(y + h) - Y(y), unit * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  } else if (hl?.kind === 'circle') {
    ctx.save()
    ctx.strokeStyle = HIGHLIGHT
    ctx.fillStyle = 'rgba(249,115,22,0.18)'
    ctx.lineWidth = unit * 1.4
    ctx.beginPath()
    ctx.arc(X(hl.x), Y(hl.y), unit * 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  for (const a of step.annotations) {
    if (a.type === 'blur' || a.type === 'spotlight') continue
    drawAnnotation(ctx, a, X, Y, unit)
  }
  return canvas
}

function pixelate(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  r: NRect,
  X: (x: number) => number,
  Y: (y: number) => number,
) {
  const x = Math.max(0, Math.floor(X(r.x)))
  const y = Math.max(0, Math.floor(Y(r.y)))
  const w = Math.min(canvas.width - x, Math.ceil(X(r.x + r.w) - X(r.x)))
  const h = Math.min(canvas.height - y, Math.ceil(Y(r.y + r.h) - Y(r.y)))
  if (w <= 0 || h <= 0) return
  // Shrink hard, then scale back up without smoothing. Heavy enough that text can't be recovered.
  const block = Math.max(8, Math.round(Math.min(w, h) / 3))
  const tiny = document.createElement('canvas')
  tiny.width = Math.max(1, Math.ceil(w / block))
  tiny.height = Math.max(1, Math.ceil(h / block))
  const t = tiny.getContext('2d')!
  t.drawImage(canvas, x, y, w, h, 0, 0, tiny.width, tiny.height)
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h)
  ctx.restore()
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2))
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function drawAnnotation(
  ctx: CanvasRenderingContext2D,
  a: Annotation,
  X: (x: number) => number,
  Y: (y: number) => number,
  unit: number,
) {
  ctx.save()
  ctx.strokeStyle = a.color
  ctx.fillStyle = a.color
  ctx.lineWidth = unit * 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (a.type) {
    case 'box': {
      const r = normRect(a)
      ctx.beginPath()
      roundRectPath(ctx, X(r.x), Y(r.y), X(r.x + r.w) - X(r.x), Y(r.y + r.h) - Y(r.y), unit * 2)
      ctx.stroke()
      break
    }
    case 'arrow': {
      const x1 = X(a.x1), y1 = Y(a.y1), x2 = X(a.x2), y2 = Y(a.y2)
      const ang = Math.atan2(y2 - y1, x2 - x1)
      const head = unit * 7
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2 - Math.cos(ang) * head * 0.6, y2 - Math.sin(ang) * head * 0.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45))
      ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45))
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'text': {
      const size = unit * 7
      ctx.font = `600 ${size}px Inter, -apple-system, Segoe UI, Roboto, sans-serif`
      const text = a.text || 'Note'
      const pad = size * 0.45
      const w = ctx.measureText(text).width + pad * 2
      const h = size + pad * 1.6
      const x = X(a.x1), y = Y(a.y1)
      ctx.beginPath()
      roundRectPath(ctx, x, y, w, h, size * 0.35)
      ctx.fill()
      ctx.fillStyle = contrastText(a.color)
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x + pad, y + h / 2 + 1)
      break
    }
    case 'marker': {
      const r = unit * 6.5
      const x = X(a.x1), y = Y(a.y1)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = unit * 0.8
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = contrastText(a.color)
      ctx.font = `700 ${r * 1.15}px Inter, -apple-system, Segoe UI, Roboto, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(a.text || '1', x, y + 1)
      break
    }
  }
  ctx.restore()
}

export function contrastText(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return r * 0.299 + g * 0.587 + b * 0.114 > 160 ? '#111827' : '#ffffff'
}
