import { describe, expect, it } from 'vitest'
import type { Step } from '../types'
import { autoZooms, buildCaptions, buildHolds, buildTracks, cameraAt, cueAt, drawsSmoothCursor, keptRanges, planVideo, timeMap, toSrt, toVtt, trackAt, zoomAt, ZOOM_IN_MS } from './timeline'

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
  it('leaves cut sections out', () => {
    // Keep 0-2s, cut 2-5s, keep 5-8s, cut 8-10s (overlapping cuts merge).
    const m = timeMap([], 0, 10000, [{ start: 2000, end: 4000 }, { start: 3500, end: 5000 }, { start: 8000, end: 12000 }])
    expect(m.outDuration).toBe(5000)
    expect(m.toSource(1999)).toBe(1999)
    expect(m.toSource(2000)).toBe(5000)
    expect(m.toSource(4999)).toBe(7999)
    expect(m.toSource(99999)).toBe(8000)
    expect(m.toOutput(3000)).toBe(2000) // inside a cut: where the cut is
    expect(m.toOutput(6000)).toBe(3000)
    expect(keptRanges(0, 10000, [{ start: 2000, end: 4000 }, { start: 3500, end: 5000 }, { start: 8000, end: 12000 }])).toEqual([[0, 2000], [5000, 8000]])
  })
  it('keeps freezes inside the kept parts, and a cut that removes everything leaves nothing', () => {
    const m = timeMap([{ at: 6000, dur: 1000 }, { at: 3000, dur: 500 }], 0, 10000, [{ start: 2000, end: 5000 }])
    expect(m.outDuration).toBe(7000 + 1000)
    expect(m.toSource(3000)).toBe(6000)
    expect(m.toSource(3500)).toBe(6000) // frozen
    expect(m.toSource(4100)).toBe(6100)
    expect(timeMap([], 0, 4000, [{ start: 0, end: 4000 }]).outDuration).toBe(0)
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
  it('drops the caption and voice of a step that was cut out', () => {
    const steps = [step('a', 1000), step('b', 3000), step('c', 5000)]
    const p = planVideo({ duration: 7000, cursor: [], trimStart: 0, cuts: [{ start: 2500, end: 4000 }], settings: { zoomScale: 1.8 } }, steps, { a: 500, b: 500, c: 500 })
    expect(p.cues.map((c) => c.stepId)).toEqual(['a', 'c'])
    expect(p.map.outDuration).toBe(5500)
    expect(p.cues[1].start).toBe(3500)
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

describe('window and screen recordings', () => {
  it('zooms and ripples at the video position, not the page position', () => {
    const s = step('a', 2000, { click: { x: 0.9, y: 0.9 }, vClick: { x: 0.3, y: 0.4 }, vRect: { x: 0.25, y: 0.38, w: 0.1, h: 0.04 } })
    const p = planVideo({ duration: 6000, source: 'screen', cursor: [], trimStart: 0, settings: { zoomScale: 2 } }, [s])
    expect(p.zooms).toHaveLength(1)
    const cam = cameraAt(2000, p.tracks, p.zooms)
    expect(cam.x).toBeLessThan(0.5)
    expect(p.tracks.hasCursor).toBe(false)
  })
})

describe('steps at the same moment', () => {
  const st = (id: string, time: number, title: string) => ({ id, kind: 'step', title, time, action: 'click', annotations: [], createdAt: 0 }) as unknown as Step
  const steps = [st('a', 1000, 'Type IL-0400 into the Search field'), st('b', 1000, 'Press Enter'), st('c', 1000, 'Click the link'), st('d', 5000, 'Click Save')]
  const ms = { a: 2500, b: 800, c: 1200, d: 900 }
  const plan = planVideo({ duration: 9000, cursor: [], trimStart: 0, settings: { zoomScale: 1.8 } }, steps, ms)
  it('never lets two narrations overlap', () => {
    const v = plan.voice
    for (let i = 1; i < v.length; i++) {
      const prev = v[i - 1]
      expect(v[i].at).toBeGreaterThanOrEqual(prev.at + ms[prev.stepId as keyof typeof ms])
    }
  })
  it('shows each caption while its own narration plays', () => {
    for (const v of plan.voice) {
      const mid = v.at + 100
      expect((cueAt(mid, plan.cues) as (typeof plan.cues)[number] | null)?.stepId).toBe(v.stepId)
    }
  })
})

describe('smooth cursor', () => {
  const v = (o: Record<string, unknown>) => ({ settings: {}, ...o }) as Parameters<typeof drawsSmoothCursor>[0]
  it('is off when the recording already shows the pointer (Chrome share dialog, window, screen)', () => {
    expect(drawsSmoothCursor(v({ source: 'tab', cursorInVideo: true }))).toBe(false)
    expect(drawsSmoothCursor(v({ source: 'screen' }))).toBe(false)
    expect(drawsSmoothCursor(v({ source: 'tab' }))).toBe(false)
  })
  it('is on for direct tab capture, which has no pointer', () => {
    expect(drawsSmoothCursor(v({ source: 'tab', cursorInVideo: false }))).toBe(true)
  })
  it('follows the switch when the person sets it', () => {
    expect(drawsSmoothCursor(v({ source: 'screen', settings: { smoothCursor: true } }))).toBe(true)
    expect(drawsSmoothCursor(v({ source: 'tab', cursorInVideo: false, settings: { smoothCursor: false } }))).toBe(false)
  })
})
