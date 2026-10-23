// Decides how much of each screenshot to show. By default, the first step on a
// page shows the whole screen, and later steps zoom in on what was clicked plus
// its label, so readers can see field names and values.
import type { Guide, NRect, Step } from './types'

export type ZoomMode = 'auto' | 'full' | 'always'

export interface StepView {
  // Area of the full screenshot to show. Undefined means the whole screen.
  crop?: NRect
  // Draw a small full-page thumbnail in the corner of zoomed images.
  inset: boolean
  // Why the view is what it is, for the editor's label.
  reason: 'custom' | 'full-step' | 'full-guide' | 'first-on-page' | 'no-target' | 'large-target' | 'little-gain' | 'zoomed'
  // How far the image is magnified (1 = full screen).
  factor: number
}

// Every zoomed image has the same shape, so documents look consistent.
export const ZOOM_ASPECT = 1.6
// Don't magnify beyond this, and keep at least this many source pixels across,
// so text stays sharp on standard (non-Retina) screens.
export const MAX_FACTOR = 3
const MIN_SOURCE_PX = 650
// Below this, zooming barely changes anything.
const MIN_USEFUL_FACTOR = 1.25
// How much of the zoomed image width the clicked element should take up.
const FOCUS_SHARE = 0.45

const pageOf = (url?: string) => (url ?? '').split('#')[0]

// IDs of steps that are the first one shown on their page.
export function firstOnPage(guide: Guide): Set<string> {
  const out = new Set<string>()
  let lastPage: string | null = null
  for (const s of guide.steps) {
    if (s.kind !== 'step') continue
    const page = pageOf(s.url)
    if (lastPage === null || page !== lastPage || !s.url) out.add(s.id)
    lastPage = page
  }
  return out
}

export function union(a: NRect, b: NRect): NRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

function clampRect(r: NRect): NRect {
  const x = Math.max(0, r.x)
  const y = Math.max(0, r.y)
  return { x, y, w: Math.max(0, Math.min(1, r.x + r.w) - x), h: Math.max(0, Math.min(1, r.y + r.h) - y) }
}

// The part of the screen the step is about: the clicked element and its label.
export function focusRect(step: Step): NRect | null {
  if (step.kind !== 'step' || !step.targetRect) return null
  if (step.action === 'navigate' || step.action === 'key') return null
  let r = step.targetRect
  if (step.labelRect) r = union(r, step.labelRect)
  r = clampRect(r)
  return r.w > 0 && r.h > 0 ? r : null
}

// A zoom area of fixed shape centred on `focus`, kept inside the screenshot.
// With no factor, picks one so the focus fills about half the width.
export function zoomAround(focus: NRect, img: { w: number; h: number }, factor?: number): NRect {
  const fw = focus.w * img.w
  const fh = focus.h * img.h
  const minW = Math.max(MIN_SOURCE_PX, img.w / MAX_FACTOR)
  // A chosen factor is respected; automatic zoom also keeps text sharp.
  let cw = factor ? img.w / Math.min(factor, MAX_FACTOR) : Math.max(fw / FOCUS_SHARE, (fh / FOCUS_SHARE) * ZOOM_ASPECT, minW)
  cw = Math.min(img.w, cw)
  let ch = cw / ZOOM_ASPECT
  if (ch > img.h) {
    ch = img.h
    cw = Math.min(img.w, ch * ZOOM_ASPECT)
  }
  const cx = (focus.x + focus.w / 2) * img.w
  const cy = (focus.y + focus.h / 2) * img.h
  // Slide the frame back inside the image instead of cutting it off.
  const x = Math.min(Math.max(0, cx - cw / 2), img.w - cw)
  const y = Math.min(Math.max(0, cy - ch / 2), img.h - ch)
  return { x: x / img.w, y: y / img.h, w: cw / img.w, h: ch / img.h }
}

export function stepView(
  guide: Pick<Guide, 'zoomMode' | 'zoomInset'>,
  step: Step,
  img: { w: number; h: number } | undefined,
  isFirstOnPage: boolean,
): StepView {
  const inset = guide.zoomInset !== false
  const full = (reason: StepView['reason']): StepView => ({ inset, reason, factor: 1 })
  if (step.crop) return { crop: step.crop, inset, reason: 'custom', factor: 1 / step.crop.w }
  if (step.zoom === 'full') return full('full-step')
  const mode = guide.zoomMode ?? 'auto'
  if (mode === 'full') return full('full-guide')
  const focus = focusRect(step)
  if (!focus || !img) return full('no-target')
  if (mode === 'auto' && isFirstOnPage) return full('first-on-page')
  if (focus.w > 0.5 || focus.h > 0.5) return full('large-target')
  const crop = zoomAround(focus, img)
  const factor = 1 / crop.w
  if (factor < MIN_USEFUL_FACTOR) return full('little-gain')
  return { crop, inset, reason: 'zoomed', factor }
}

// Views for every step in a guide, keyed by step ID.
export function guideViews(guide: Guide, sizes: Record<string, { w: number; h: number }>): Map<string, StepView> {
  const first = firstOnPage(guide)
  const out = new Map<string, StepView>()
  for (const s of guide.steps) {
    out.set(s.id, stepView(guide, s, s.imageId ? sizes[s.imageId] : undefined, first.has(s.id)))
  }
  return out
}

export const REASON_TEXT: Record<StepView['reason'], string> = {
  custom: 'Custom zoom',
  'full-step': 'Full screen',
  'full-guide': 'Full screen (guide setting)',
  'first-on-page': 'Full screen: first step on this page',
  'no-target': 'Full screen',
  'large-target': 'Full screen: large click area',
  'little-gain': 'Full screen: already readable',
  zoomed: 'Auto zoom',
}
