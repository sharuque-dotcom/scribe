// Draws one frame of the finished video: background, the recording under the
// zoom camera, blur over secret fields, the smooth cursor, a click ripple and
// the caption. Used by both the editor preview and the export.
import type { NRect, RedactSample, VideoBackground } from '../types'
import type { Camera } from './timeline'

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

// Exported video size: 1080p with the background, or the recording's own shape without it.
export function outputSize(srcW: number, srcH: number, background: VideoBackground, maxW = 1920): { W: number; H: number } {
  if (background !== 'none') return { W: maxW, H: even((maxW * 9) / 16) }
  const w = Math.min(maxW, even(srcW))
  return { W: w, H: even((w * srcH) / srcW) }
}

export interface Layout {
  W: number
  H: number
  // Where the recording sits on the canvas.
  vx: number
  vy: number
  vw: number
  vh: number
  radius: number
  // Size multiplier relative to a 1080p frame, for cursor, captions, etc.
  k: number
}

export function layoutFor(W: number, H: number, srcW: number, srcH: number, background: VideoBackground): Layout {
  const k = H / 1080
  const pad = background === 'none' ? 0 : Math.round(Math.min(W, H) * 0.07)
  const aw = W - pad * 2
  const ah = H - pad * 2
  const s = Math.min(aw / srcW, ah / srcH)
  const vw = Math.round(srcW * s)
  const vh = Math.round(srcH * s)
  return { W, H, vx: Math.round((W - vw) / 2), vy: Math.round((H - vh) / 2), vw, vh, radius: background === 'none' ? 0 : Math.round(18 * k), k }
}

export interface FrameState {
  cam: Camera
  cursor: { x: number; y: number } | null
  ripple: { x: number; y: number; age: number } | null
  caption: { text: string; alpha: number } | null
  redact: NRect[]
}

export function redactAt(t: number, samples: RedactSample[]): NRect[] {
  let rects: NRect[] = []
  for (const s of samples) {
    if (s.t > t) break
    rects = s.rects
  }
  return rects
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function paintBackground(ctx: Ctx, L: Layout, bg: VideoBackground) {
  if (bg === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, L.W, L.H)
    g.addColorStop(0, '#4f46e5')
    g.addColorStop(0.55, '#7c3aed')
    g.addColorStop(1, '#db2777')
    ctx.fillStyle = g
  } else ctx.fillStyle = bg === 'light' ? '#e2e8f0' : '#0f172a'
  ctx.fillRect(0, 0, L.W, L.H)
}

let tiny: OffscreenCanvas | null = null

export function drawFrame(ctx: Ctx, L: Layout, bg: VideoBackground, frame: CanvasImageSource | null, fw: number, fh: number, st: FrameState) {
  paintBackground(ctx, L, bg)

  // Recording, in a rounded card with a soft shadow.
  if (bg !== 'none') {
    ctx.save()
    ctx.shadowColor = 'rgba(15,23,42,0.45)'
    ctx.shadowBlur = 40 * L.k
    ctx.shadowOffsetY = 12 * L.k
    ctx.fillStyle = '#000'
    roundRect(ctx, L.vx, L.vy, L.vw, L.vh, L.radius)
    ctx.fill()
    ctx.restore()
  }
  ctx.save()
  roundRect(ctx, L.vx, L.vy, L.vw, L.vh, L.radius)
  ctx.clip()

  // The camera shows a 1/scale part of the recording, centred on cam.x/cam.y.
  const sw = fw / st.cam.scale
  const sh = fh / st.cam.scale
  const sx = st.cam.x * fw - sw / 2
  const sy = st.cam.y * fh - sh / 2
  if (frame) ctx.drawImage(frame, sx, sy, sw, sh, L.vx, L.vy, L.vw, L.vh)
  else {
    ctx.fillStyle = '#000'
    ctx.fillRect(L.vx, L.vy, L.vw, L.vh)
  }
  const X = (nx: number) => L.vx + ((nx * fw - sx) / sw) * L.vw
  const Y = (ny: number) => L.vy + ((ny * fh - sy) / sh) * L.vh

  // Secret fields: shrink hard, then scale back up without smoothing.
  if (frame) {
    for (const r of st.redact) {
      const x = X(r.x), y = Y(r.y), w = X(r.x + r.w) - x, h = Y(r.y + r.h) - y
      if (w < 1 || h < 1) continue
      tiny ??= new OffscreenCanvas(1, 1)
      tiny.width = Math.max(1, Math.round(w / (12 * L.k)))
      tiny.height = Math.max(1, Math.round(h / (12 * L.k)))
      const t = tiny.getContext('2d')!
      t.drawImage(frame, r.x * fw, r.y * fh, r.w * fw, r.h * fh, 0, 0, tiny.width, tiny.height)
      ctx.save()
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, x, y, w, h)
      ctx.restore()
    }
  }

  // Click ripple.
  if (st.ripple) {
    const { x, y, age } = st.ripple
    ctx.save()
    ctx.strokeStyle = `rgba(99,102,241,${0.75 * (1 - age)})`
    ctx.fillStyle = `rgba(99,102,241,${0.18 * (1 - age)})`
    ctx.lineWidth = 3 * L.k
    ctx.beginPath()
    ctx.arc(X(x), Y(y), (10 + 34 * age) * L.k * (0.7 + 0.3 * st.cam.scale), 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  // Cursor: a larger, smooth arrow drawn on top (tab recordings have no cursor).
  if (st.cursor) drawCursor(ctx, X(st.cursor.x), Y(st.cursor.y), 1.25 * L.k * (0.85 + 0.15 * st.cam.scale))
  ctx.restore()

  if (st.caption && st.caption.alpha > 0.01) drawCaption(ctx, L, st.caption.text, st.caption.alpha)
}

function drawCursor(ctx: Ctx, x: number, y: number, s: number) {
  const pts: [number, number][] = [
    [0, 0], [0, 23], [6, 17.5], [10.5, 27], [14.5, 25.2], [10.2, 16], [18, 16],
  ]
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.beginPath()
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
  ctx.closePath()
  ctx.fillStyle = '#111827'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.lineWidth = 1.8
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.restore()
}

function wrap(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= maxW || !line) line = next
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + '…'
    return kept
  }
  return lines
}

function drawCaption(ctx: Ctx, L: Layout, text: string, alpha: number) {
  const size = Math.round(34 * L.k)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `600 ${size}px Inter, -apple-system, "Segoe UI", Roboto, sans-serif`
  const maxW = Math.min(L.vw * 0.84, 1400 * L.k)
  const lines = wrap(ctx, text, maxW, 2)
  const lh = size * 1.3
  const padX = size * 0.8
  const padY = size * 0.5
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2
  const h = lines.length * lh + padY * 2
  const x = L.W / 2 - w / 2
  const y = L.vy + L.vh - h - Math.max(24 * L.k, L.vh * 0.05)
  ctx.fillStyle = 'rgba(15,23,42,0.86)'
  roundRect(ctx, x, y, w, h, size * 0.45)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => ctx.fillText(l, L.W / 2, y + padY + lh * i + lh / 2))
  ctx.restore()
}

// Caption fades in and out over 200 ms.
export function captionAlpha(t: number, start: number, end: number): number {
  return Math.max(0, Math.min(1, (t - start) / 200, (end - t) / 200))
}
