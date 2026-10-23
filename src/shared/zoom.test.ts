import { describe, expect, it } from 'vitest'
import type { Guide, Step } from './types'
import { firstOnPage, focusRect, guideViews, MAX_FACTOR, stepView, ZOOM_ASPECT, zoomAround } from './zoom'

const IMG = { w: 1920, h: 1080 }
const field = { x: 0.4, y: 0.4, w: 0.15, h: 0.04 }

const step = (id: string, url: string, over: Partial<Step> = {}): Step => ({
  id,
  kind: 'step',
  title: id,
  action: 'click',
  url,
  imageId: 'img',
  targetRect: field,
  annotations: [],
  createdAt: 0,
  ...over,
})

const guide = (steps: Step[], over: Partial<Guide> = {}): Guide => ({
  id: 'g', title: 't', description: '', createdAt: 0, updatedAt: 0, status: 'ready', docs: {}, steps, ...over,
})

describe('firstOnPage', () => {
  it('marks the first step on each page, ignoring #hash changes', () => {
    const g = guide([
      step('a', 'https://x.com/login'),
      step('b', 'https://x.com/login#pw'),
      { id: 'n', kind: 'note', title: '', annotations: [], createdAt: 0 },
      step('c', 'https://x.com/home'),
      step('d', 'https://x.com/home'),
      step('e', 'https://x.com/login'),
    ])
    expect([...firstOnPage(g)]).toEqual(['a', 'c', 'e'])
  })
})

describe('zoomAround', () => {
  it('keeps a fixed 16:10 shape, inside the image', () => {
    const r = zoomAround(field, IMG)
    expect((r.w * IMG.w) / (r.h * IMG.h)).toBeCloseTo(ZOOM_ASPECT, 5)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(r.y).toBeGreaterThanOrEqual(0)
    expect(r.x + r.w).toBeLessThanOrEqual(1 + 1e-9)
    expect(r.y + r.h).toBeLessThanOrEqual(1 + 1e-9)
  })

  it('centres on the element', () => {
    const r = zoomAround(field, IMG)
    expect(r.x + r.w / 2).toBeCloseTo(field.x + field.w / 2, 5)
    expect(r.y + r.h / 2).toBeCloseTo(field.y + field.h / 2, 5)
  })

  it('slides the frame back inside near an edge', () => {
    const corner = { x: 0.95, y: 0.96, w: 0.04, h: 0.03 }
    const r = zoomAround(corner, IMG)
    expect(r.x + r.w).toBeCloseTo(1, 5)
    expect(r.y + r.h).toBeCloseTo(1, 5)
  })

  it('never magnifies past the sharpness limit for tiny elements', () => {
    const tiny = { x: 0.5, y: 0.5, w: 0.005, h: 0.005 }
    expect(1 / zoomAround(tiny, IMG).w).toBeLessThanOrEqual(MAX_FACTOR + 1e-9)
    // On a small screenshot, at least 650 source pixels stay in view.
    expect(zoomAround(tiny, { w: 1280, h: 800 }).w * 1280).toBeGreaterThanOrEqual(650 - 1e-6)
  })

  it('uses a chosen factor', () => {
    expect(1 / zoomAround(field, IMG, 2).w).toBeCloseTo(2, 5)
  })
})

describe('focusRect', () => {
  it('includes the label', () => {
    const r = focusRect(step('a', 'u', { labelRect: { x: 0.4, y: 0.36, w: 0.05, h: 0.02 } }))!
    expect(r.y).toBeCloseTo(0.36)
    expect(r.y + r.h).toBeCloseTo(0.44)
  })
  it('has no focus for navigation, key presses and notes', () => {
    expect(focusRect(step('a', 'u', { action: 'navigate' }))).toBeNull()
    expect(focusRect(step('a', 'u', { action: 'key' }))).toBeNull()
    expect(focusRect({ ...step('a', 'u'), kind: 'note' })).toBeNull()
  })
})

describe('stepView', () => {
  const auto = { zoomMode: undefined, zoomInset: undefined }
  it('shows the first step on a page in full and zooms later ones', () => {
    const first = stepView(auto, step('a', 'u'), IMG, true)
    expect(first.reason).toBe('first-on-page')
    expect(first.crop).toBeUndefined()
    const v = stepView(auto, step('a', 'u'), IMG, false)
    expect(v.reason).toBe('zoomed')
    expect(v.factor).toBeGreaterThan(1.25)
    expect(v.inset).toBe(true)
  })
  it('keeps large click areas in full', () => {
    expect(stepView(auto, step('a', 'u', { targetRect: { x: 0, y: 0.1, w: 0.8, h: 0.6 } }), IMG, false).reason).toBe('large-target')
  })
  it('follows step and guide overrides', () => {
    const custom = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 }
    expect(stepView(auto, step('a', 'u', { crop: custom }), IMG, true)).toMatchObject({ reason: 'custom', crop: custom, factor: 2 })
    expect(stepView(auto, step('a', 'u', { zoom: 'full' }), IMG, false).reason).toBe('full-step')
    expect(stepView({ zoomMode: 'full' }, step('a', 'u'), IMG, false).reason).toBe('full-guide')
    expect(stepView({ zoomMode: 'always' }, step('a', 'u'), IMG, true).reason).toBe('zoomed')
    expect(stepView({ zoomInset: false }, step('a', 'u'), IMG, false).inset).toBe(false)
  })
})

describe('guideViews', () => {
  it('works out a view for every step', () => {
    const g = guide([step('a', 'https://x.com/1'), step('b', 'https://x.com/1')])
    const v = guideViews(g, { img: IMG })
    expect(v.get('a')!.reason).toBe('first-on-page')
    expect(v.get('b')!.reason).toBe('zoomed')
  })
})
