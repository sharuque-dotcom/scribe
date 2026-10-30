// Everything about *when* things happen in a video: zooms, where the camera
// points, the smooth cursor, captions, and short freezes so narration can finish.
// Times are milliseconds. "Source" time is the raw recording; "output" time is
// the exported video after trimming and freezes.
import { focusRect } from '../zoom'
import type { CursorSample, Step, ZoomSegment } from '../types'

export const ZOOM_IN_MS = 700
export const ZOOM_OUT_MS = 800
// Start zooming this long before a click, and stay zoomed this long after.
const LEAD_MS = 900
const HOLD_MS = 1800
// Clicks closer together than this share one zoom (the camera pans between them).
const MERGE_GAP_MS = 1500
// Captions disappear after this long if nothing else happens.
const CAPTION_MAX_MS = 5000
// Narration starts this long after the step's caption appears.
export const VOICE_DELAY_MS = 150
// Breathing room after narration before the next action.
const VOICE_GAP_MS = 300

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

const isTimedStep = (s: Step): s is Step & { time: number } => s.kind === 'step' && typeof s.time === 'number'

// ---------- zooms ----------

export function autoZooms(steps: Step[], duration: number, scale: number): ZoomSegment[] {
  const clicks = steps
    .filter(isTimedStep)
    .filter((s) => {
      const f = focusRect(s)
      return f && f.w <= 0.5 && f.h <= 0.5
    })
    .sort((a, b) => a.time - b.time)
  const pageOf = (s: Step) => (s.url ?? '').split('#')[0]
  const out: ZoomSegment[] = []
  let lastPage: string | null = null
  for (const s of clicks) {
    const start = Math.max(0, s.time - LEAD_MS)
    const end = Math.min(duration, s.time + HOLD_MS)
    const last = out[out.length - 1]
    const samePage = lastPage === null || pageOf(s) === lastPage
    if (last && samePage && start <= last.end + MERGE_GAP_MS) last.end = Math.max(last.end, end)
    else {
      // A new page always zooms back out first, so viewers see where they are.
      if (last && !samePage) last.end = Math.min(last.end, Math.max(last.start + ZOOM_IN_MS, start))
      out.push({ id: `auto-${out.length}`, start, end, scale })
    }
    lastPage = pageOf(s)
  }
  return out.filter((z) => z.end - z.start >= ZOOM_IN_MS)
}

// How far zoomed in at time t: scale (1 = full screen) and progress 0..1.
export function zoomAt(t: number, zooms: ZoomSegment[]): { scale: number; p: number } {
  let best = { scale: 1, p: 0 }
  for (const z of zooms) {
    if (t < z.start || t > z.end) continue
    const len = z.end - z.start
    const inMs = Math.min(ZOOM_IN_MS, len / 2)
    const outMs = Math.min(ZOOM_OUT_MS, len / 2)
    const p = easeInOut(Math.min(clamp((t - z.start) / inMs), clamp((z.end - t) / outMs)))
    const scale = 1 + (z.scale - 1) * p
    if (scale > best.scale) best = { scale, p }
  }
  return best
}

// ---------- cursor and camera paths ----------

export const TRACK_FPS = 60
const TRACK_DT = 1000 / TRACK_FPS

export interface Tracks {
  // Smoothed cursor position and camera focus, sampled TRACK_FPS times a second,
  // stored as x,y pairs.
  cursor: Float32Array
  focus: Float32Array
  n: number
  hasCursor: boolean
}

// Where the mouse was at time t, from the recorded samples.
function rawAt(samples: CursorSample[], t: number): { x: number; y: number } {
  if (!samples.length) return { x: 0.5, y: 0.5 }
  if (t <= samples[0].t) return samples[0]
  const last = samples[samples.length - 1]
  if (t >= last.t) return last
  let lo = 0
  let hi = samples.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = samples[lo]
  const b = samples[hi]
  const k = (t - a.t) / Math.max(1, b.t - a.t)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

export function buildTracks(cursor: CursorSample[], steps: Step[], duration: number): Tracks {
  // Every click is a known cursor position, even if no mouse movement was sent.
  const clicks: CursorSample[] = steps
    .filter(isTimedStep)
    .flatMap((s) => {
      const p = s.click ?? (s.targetRect ? { x: s.targetRect.x + s.targetRect.w / 2, y: s.targetRect.y + s.targetRect.h / 2 } : null)
      return p ? [{ t: s.time, x: p.x, y: p.y }] : []
    })
  const samples = [...cursor, ...clicks].sort((a, b) => a.t - b.t)
  const n = Math.max(1, Math.ceil(duration / TRACK_DT) + 1)
  const cur = new Float32Array(n * 2)
  const foc = new Float32Array(n * 2)
  // The cursor is smoothed a little so it glides; the camera much more, and
  // looks slightly ahead so it arrives with the cursor instead of chasing it.
  const kCursor = 1 - Math.exp(-TRACK_DT / 55)
  const kFocus = 1 - Math.exp(-TRACK_DT / 320)
  let cx = rawAt(samples, 0).x
  let cy = rawAt(samples, 0).y
  let fx = rawAt(samples, 250).x
  let fy = rawAt(samples, 250).y
  for (let i = 0; i < n; i++) {
    const t = i * TRACK_DT
    const r = rawAt(samples, t)
    cx += (r.x - cx) * kCursor
    cy += (r.y - cy) * kCursor
    const ahead = rawAt(samples, t + 250)
    fx += (ahead.x - fx) * kFocus
    fy += (ahead.y - fy) * kFocus
    cur[i * 2] = cx
    cur[i * 2 + 1] = cy
    foc[i * 2] = fx
    foc[i * 2 + 1] = fy
  }
  return { cursor: cur, focus: foc, n, hasCursor: samples.length > 0 }
}

export function trackAt(arr: Float32Array, n: number, t: number): { x: number; y: number } {
  const f = clamp(t / TRACK_DT, 0, n - 1)
  const i = Math.floor(f)
  const j = Math.min(n - 1, i + 1)
  const k = f - i
  return { x: arr[i * 2] + (arr[j * 2] - arr[i * 2]) * k, y: arr[i * 2 + 1] + (arr[j * 2 + 1] - arr[i * 2 + 1]) * k }
}

export interface Camera {
  scale: number
  // Centre of the view, 0..1 of the recording.
  x: number
  y: number
}

export function cameraAt(t: number, tracks: Tracks, zooms: ZoomSegment[]): Camera {
  const { scale, p } = zoomAt(t, zooms)
  if (scale <= 1.0001) return { scale: 1, x: 0.5, y: 0.5 }
  const f = trackAt(tracks.focus, tracks.n, t)
  // Move from the centre toward the focus as the zoom comes in.
  const half = 0.5 / scale
  return {
    scale,
    x: clamp(0.5 + (f.x - 0.5) * p, half, 1 - half),
    y: clamp(0.5 + (f.y - 0.5) * p, half, 1 - half),
  }
}

// A ripple that grows from each click for a moment.
export function rippleAt(t: number, steps: Step[]): { x: number; y: number; age: number } | null {
  for (const s of steps) {
    if (!isTimedStep(s) || !s.click || (s.action !== 'click' && s.action !== 'type' && s.action !== 'select')) continue
    const age = t - s.time
    if (age >= 0 && age < 600) return { ...s.click, age: age / 600 }
  }
  return null
}

// ---------- captions ----------

export interface Caption {
  stepId: string
  start: number
  end: number
  text: string
}

export function buildCaptions(steps: Step[], duration: number): Caption[] {
  const timed = steps.filter(isTimedStep).sort((a, b) => a.time - b.time)
  return timed.map((s, i) => {
    const next = timed[i + 1]?.time ?? duration
    const end = Math.min(next, s.time + CAPTION_MAX_MS, duration)
    return { stepId: s.id, start: s.time, end: Math.max(end, Math.min(duration, s.time + 400)), text: (s.narration || s.title).trim() }
  })
}

export function captionAt(t: number, captions: Caption[]): Caption | null {
  for (let i = captions.length - 1; i >= 0; i--) {
    const c = captions[i]
    if (t >= c.start && t < c.end) return c
  }
  return null
}

// ---------- freezes so narration can finish ----------

export interface Hold {
  // Source time at which the video freezes.
  at: number
  dur: number
}

// If a step's narration is longer than the gap before the next action,
// freeze the frame just before that action until the narration ends.
export function buildHolds(captions: Caption[], voiceMs: Record<string, number>, duration: number): Hold[] {
  const holds: Hold[] = []
  captions.forEach((c, i) => {
    const v = voiceMs[c.stepId]
    if (!v) return
    const next = captions[i + 1]?.start ?? duration
    const available = next - (c.start + VOICE_DELAY_MS)
    const need = v + VOICE_GAP_MS
    if (need > available) holds.push({ at: Math.max(c.start, next - 1), dur: Math.round(need - available) })
  })
  return holds
}

export interface TimeMap {
  outDuration: number
  toSource(out: number): number
  toOutput(src: number): number
}

export function timeMap(holds: Hold[], trimStart: number, trimEnd: number): TimeMap {
  const hs = holds.filter((h) => h.at >= trimStart && h.at < trimEnd).sort((a, b) => a.at - b.at)
  const total = hs.reduce((a, h) => a + h.dur, 0)
  return {
    outDuration: Math.max(0, trimEnd - trimStart) + total,
    toOutput(src) {
      const s = clamp(src, trimStart, trimEnd)
      let o = s - trimStart
      for (const h of hs) if (h.at < s) o += h.dur
      return o
    },
    toSource(out) {
      let cur = trimStart
      let o = 0
      for (const h of hs) {
        const len = h.at - cur
        if (out < o + len) return cur + (out - o)
        o += len
        cur = h.at
        if (out < o + h.dur) return h.at
        o += h.dur
      }
      return Math.min(trimEnd, cur + Math.max(0, out - o))
    },
  }
}

// ---------- subtitle files ----------

export interface Cue {
  start: number
  end: number
  text: string
}

const stamp = (ms: number, sep: string) => {
  const t = Math.max(0, Math.round(ms))
  const h = Math.floor(t / 3_600_000)
  const m = Math.floor((t % 3_600_000) / 60_000)
  const s = Math.floor((t % 60_000) / 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(t % 1000, 3)}`
}

export const toVtt = (cues: Cue[]) =>
  'WEBVTT\n\n' + cues.map((c, i) => `${i + 1}\n${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')

export const toSrt = (cues: Cue[]) => cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n')

// ---------- everything for one guide ----------

export interface VideoPlan {
  zooms: ZoomSegment[]
  tracks: Tracks
  captions: Caption[]
  holds: Hold[]
  map: TimeMap
  trimStart: number
  trimEnd: number
  // Captions and narration in output time (what the exported video shows).
  cues: (Cue & { stepId: string })[]
  voice: { stepId: string; at: number }[]
}

export function planVideo(
  video: { duration: number; cursor: CursorSample[]; zooms?: ZoomSegment[]; trimStart: number; trimEnd?: number; settings: { zoomScale: number } },
  steps: Step[],
  voiceMs: Record<string, number> = {},
): VideoPlan {
  const duration = video.duration
  const trimStart = clamp(video.trimStart, 0, duration)
  const trimEnd = clamp(video.trimEnd ?? duration, trimStart, duration)
  const zooms = video.zooms ?? autoZooms(steps, duration, video.settings.zoomScale)
  const tracks = buildTracks(video.cursor, steps, duration)
  const captions = buildCaptions(steps, duration).filter((c) => c.end > trimStart && c.start < trimEnd && c.text)
  const holds = buildHolds(captions, voiceMs, duration)
  const map = timeMap(holds, trimStart, trimEnd)
  const voice = captions.filter((c) => voiceMs[c.stepId]).map((c) => ({ stepId: c.stepId, at: map.toOutput(c.start) + VOICE_DELAY_MS }))
  const cues = captions.map((c) => {
    const start = map.toOutput(c.start)
    let end = map.toOutput(c.end)
    // Keep the caption up while its narration is still playing.
    const v = voiceMs[c.stepId]
    if (v) end = Math.max(end, Math.min(map.outDuration, start + VOICE_DELAY_MS + v))
    return { stepId: c.stepId, start, end, text: c.text }
  })
  return { zooms, tracks, captions, holds, map, trimStart, trimEnd, cues, voice }
}

export function cueAt(t: number, cues: Cue[]): Cue | null {
  for (let i = cues.length - 1; i >= 0; i--) if (t >= cues[i].start && t < cues[i].end) return cues[i]
  return null
}
