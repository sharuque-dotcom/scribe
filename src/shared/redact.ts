// Pixelates secret fields (card numbers, passwords, keys) directly in an image,
// so the saved screenshot or video frame never holds the readable value.
// Works with page canvases and OffscreenCanvas (background worker, recorder).
import type { NRect } from './types'

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// Pixel box for a 0..1 rect on a w×h image, grown by `pad` px so edges don't leak.
export function pixelBox(r: NRect, w: number, h: number, pad = 0): { x: number; y: number; w: number; h: number } | null {
  const x = Math.max(0, Math.floor(r.x * w - pad))
  const y = Math.max(0, Math.floor(r.y * h - pad))
  const x2 = Math.min(w, Math.ceil((r.x + r.w) * w + pad))
  const y2 = Math.min(h, Math.ceil((r.y + r.h) * h + pad))
  return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null
}

// Block size: heavy enough that text can't be recovered.
export const blockSize = (w: number, h: number) => Math.max(8, Math.round(Math.min(w, h) / 3))

let bufA: OffscreenCanvas | null = null
let bufB: OffscreenCanvas | null = null

// Pixelates one pixel box of the canvas in place. The box is shrunk in halving
// steps so every block is the average of its area (a single big shrink only
// samples a few points, which can leave hard dark bars).
export function pixelateBox(ctx: Ctx, canvas: AnyCanvas, b: { x: number; y: number; w: number; h: number }, block = blockSize(b.w, b.h)) {
  const tw = Math.max(1, Math.ceil(b.w / block))
  const th = Math.max(1, Math.ceil(b.h / block))
  bufA ??= new OffscreenCanvas(1, 1)
  bufB ??= new OffscreenCanvas(1, 1)
  let src: OffscreenCanvas | AnyCanvas = canvas
  let sx = b.x, sy = b.y, sw = b.w, sh = b.h
  let dst = bufA
  for (;;) {
    const w = Math.max(tw, Math.ceil(sw / 2))
    const h = Math.max(th, Math.ceil(sh / 2))
    dst.width = w
    dst.height = h
    const d = dst.getContext('2d')!
    d.imageSmoothingEnabled = true
    d.imageSmoothingQuality = 'high'
    d.drawImage(src, sx, sy, sw, sh, 0, 0, w, h)
    src = dst
    sx = sy = 0
    sw = w
    sh = h
    if (w === tw && h === th) break
    dst = dst === bufA ? bufB : bufA
  }
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, 0, 0, tw, th, b.x, b.y, b.w, b.h)
  ctx.restore()
}

// Pixelates each 0..1 rect of the whole canvas in place.
export function pixelateRects(canvas: AnyCanvas, rects: NRect[], pad = 4) {
  const ctx = canvas.getContext('2d') as Ctx | null
  if (!ctx) return
  for (const r of rects) {
    const b = pixelBox(r, canvas.width, canvas.height, pad)
    if (b) pixelateBox(ctx, canvas, b)
  }
}
