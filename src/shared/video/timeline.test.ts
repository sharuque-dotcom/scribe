import { describe, expect, it } from 'vitest'
import type { Step } from '../types'
import { autoZooms, buildCaptions, buildHolds, buildTracks, cameraAt, planVideo, timeMap, toSrt, toVtt, trackAt, zoomAt, ZOOM_IN_MS } from './timeline'

const step = (id: string, time: number, over: Partial<Step> = {}): Step => ({
  id,
  kind: 'step',
  title: `Step ${id}`,
  action: 'click',
  time,
  targetRect: { x: 0.7, y: 0.6, w: 0.1, h: 0.05 },
  click: { x: 0.75, y: 0.62 },
  annotations: [],
  createdAt: 0,
  ...over,
})

describe('autoZooms', () => {
  it('zooms around each click and merges clicks close together', () => {
    const z = autoZooms([step('a', 2000), step('b', 3500), step('c', 12000)], 20000, 1.8)
    expect(z).toHaveLength(2)
    expect(z[0]).toMatchObject({ start: 1100, end: 5300, scale: 1.8 })
    expect(z[1].start).toBe(11100)
  })
  it('zooms out when the page changes, even between quick clicks', () => {
    const z = autoZooms([step('a', 2000, { url: 'https://x/login' }), step('b', 3000, { url: 'https://x/login' }), step('c', 4000, { url: 'https://x/home' })], 9000, 2)
    expect(z).toHaveLength(2)
    expect(z[0].end).toBeLessThanOrEqual(z[1].start)
  })
  it('skips navigation, key presses and large click areas', () => {
    const z = autoZooms(
      [step('nav', 0, { action: 'navigate' }), step('key', 2000, { action: 'key' }), step('big', 5000, { targetRect: { x: 0, y: 0, w: 0.9, h: 0.8 } })],
      10000,
      2,
    )
    expect(z).toEqual([])
  })
})

describe('zoomAt and cameraAt', () => {
  const zooms = [{ id: 'z', start: 1000, end: 4000, scale: 2 }]
  it('eases in, holds, then eases out', () => {
    expect(zoomAt(999, zooms).scale).toBe(1)
    expect(zoomAt(1000 + ZOOM_IN_MS / 2, zooms).scale).toBeCloseTo(1.5, 1)
    expect(zoomAt(2500, zooms).scale).toBe(2)
    expect(zoomAt(4000, zooms).scale).toBe(1)
  })
  it('points the camera at the cursor and keeps the view inside the frame', () => {
    const tracks = buildTracks([{ t: 0, x: 0.95, y: 0.95 }], [], 5000)
    const cam = cameraAt(2500, tracks, zooms)
    expect(cam.scale).toBe(2)
    // At 2x the view is half the frame wide, so its centre can't go past 0.75.
    expect(cam.x).toBeCloseTo(0.75, 5)
    expect(cam.y).toBeCloseTo(0.75, 5)
    expect(cameraAt(500, tracks, zooms)).toEqual({ scale: 1, x: 0.5, y: 0.5 })
  })
})

describe('buildTracks', () => {
  it('glides toward each click position', () => {
    const t = buildTracks([{ t: 0, x: 0.1, y: 0.1 }], [step('a', 1000, { click: { x: 0.9, y: 0.9 } })], 3000)
    const early = trackAt(t.cursor, t.n, 100)
    const late = trackAt(t.cursor, t.n, 2500)
    expect(early.x).toBeLessThan(0.2)
    expect(late.x).toBeGreaterThan(0.88)
  })
})

describe('captions and freezes', () => {
  const steps = [step('a', 1000), step('b', 3000), step('c', 10000, { narration: 'Finally, save it.' })]
  it('shows each caption until the next step, at most 5 seconds', () => {
    const c = buildCaptions(steps, 20000)
    expect(c.map((x) => [x.start, x.end])).toEqual([
      [1000, 3000],
      [3000, 8000],
      [10000, 15000],
    ])
    expect(c[2].text).toBe('Finally, save it.')
  })
  it('freezes before the next action when narration is too long', () => {
    const c = buildCaptions(steps, 20000)
    const holds = buildHolds(c, { a: 3000, b: 1000 }, 20000)
    // Step a has 2s before step b; 3s of voice + gap needs ~1.45s more.
    expect(holds).toEqual([{ at: 2999, dur: 1450 }])
  })
  it('maps output time to recording time around freezes and trims', () => {
    const m = timeMap([{ at: 3000, dur: 1000 }], 500, 9500)
    expect(m.outDuration).toBe(10000)
    expect(m.toSource(0)).toBe(500)
    expect(m.toSource(2400)).toBe(2900)
    expect(m.toSource(2600)).toBe(3000) // frozen
    expect(m.toSource(3400)).toBe(3000) // still frozen
    expect(m.toSource(3600)).toBe(3100)
    expect(m.toOutput(3100)).toBe(3600)
    expect(m.toSource(99999)).toBe(9500)
  })
})

describe('planVideo', () => {
  it('lines up captions and narration in output time', () => {
    const steps = [step('a', 1000), step('b', 3000)]
    const p = planVideo({ duration: 6000, cursor: [], trimStart: 0, settings: { zoomScale: 1.8 } }, steps, { a: 3000 })
    expect(p.map.outDuration).toBe(6000 + 1450)
    expect(p.voice).toEqual([{ stepId: 'a', at: 1150 }])
    // Caption a stays up through the freeze until step b.
    expect(p.cues[0]).toMatchObject({ start: 1000, end: 4450 })
    expect(p.cues[1].start).toBe(4450)
  })
})

describe('subtitle files', () => {
  const cues = [{ start: 1000, end: 3500, text: 'Click Save' }, { start: 3725002, end: 3726000, text: 'Done' }]
  it('writes WebVTT', () => {
    expect(toVtt(cues)).toBe('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.500\nClick Save\n\n2\n01:02:05.002 --> 01:02:06.000\nDone\n')
  })
  it('writes SRT', () => {
    expect(toSrt(cues)).toBe('1\n00:00:01,000 --> 00:00:03,500\nClick Save\n\n2\n01:02:05,002 --> 01:02:06,000\nDone\n')
  })
})
