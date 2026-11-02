import { describe, expect, it } from 'vitest'
import { estimateOrigin, monitorOffset, pickedSource, toVideoPoint, toVideoRect, type ScreenGeom } from './coords'

const g: ScreenGeom = { winX: 100, winY: 50, winW: 1200, winH: 800, scrX: 0, scrY: 0, scrW: 1600, scrH: 1000 }

describe('toVideoPoint', () => {
  it('maps screen positions into an entire-screen recording', () => {
    expect(toVideoPoint('screen', 800, 500, g)).toEqual({ x: 0.5, y: 0.5 })
  })
  it('maps screen positions into a window recording', () => {
    expect(toVideoPoint('window', 700, 450, g)).toEqual({ x: 0.5, y: 0.5 })
  })
  it('handles a second monitor to the left', () => {
    const left = { ...g, scrX: -1600, winX: -1500 }
    expect(toVideoPoint('screen', -800, 500, left)).toEqual({ x: 0.5, y: 0.5 })
  })
})

describe('toVideoRect', () => {
  it('converts an element rectangle', () => {
    expect(toVideoRect('screen', 400, 250, 800, 500, g)).toEqual({ x: 0.25, y: 0.25, w: 0.25, h: 0.25 })
  })
})

describe('monitorOffset', () => {
  it('ignores small insets like a menu bar or taskbar', () => {
    expect(monitorOffset(25, 1000)).toBe(0)
    expect(monitorOffset(undefined, 1000)).toBe(0)
  })
  it('keeps real monitor offsets', () => {
    expect(monitorOffset(-1920, 1920)).toBe(-1920)
    expect(monitorOffset(1920, 1920)).toBe(1920)
  })
})

describe('estimateOrigin', () => {
  it('puts the page below the toolbar, inside the borders', () => {
    // 1200x800 window with a 1192x700 page: 4px side borders, toolbar on top.
    expect(estimateOrigin(g, 1192, 700)).toEqual({ x: 104, y: 146 })
  })
})

describe('pickedSource', () => {
  it('reads the display surface, then the track label', () => {
    expect(pickedSource('browser', '')).toBe('tab')
    expect(pickedSource('window', '')).toBe('window')
    expect(pickedSource('monitor', '')).toBe('screen')
    expect(pickedSource(undefined, 'web-contents-media-stream://12:3')).toBe('tab')
    expect(pickedSource(undefined, 'window:1234:0')).toBe('window')
    expect(pickedSource(undefined, 'screen:0:0')).toBe('screen')
  })
})
