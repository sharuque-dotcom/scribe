import { describe, expect, it } from 'vitest'
import { blockSize, pixelBox } from './redact'

describe('pixelBox', () => {
  it('converts a 0..1 rect to pixels, with padding, clamped to the image', () => {
    expect(pixelBox({ x: 0.25, y: 0.5, w: 0.5, h: 0.1 }, 400, 200, 4)).toEqual({ x: 96, y: 96, w: 208, h: 28 })
    expect(pixelBox({ x: -0.1, y: 0.95, w: 0.3, h: 0.2 }, 100, 100, 2)).toEqual({ x: 0, y: 93, w: 22, h: 7 })
  })
  it('skips rects outside the image', () => {
    expect(pixelBox({ x: 1.2, y: 0, w: 0.1, h: 0.1 }, 100, 100)).toBeNull()
  })
  it('uses blocks big enough to hide text', () => {
    expect(blockSize(300, 40)).toBe(13)
    expect(blockSize(30, 12)).toBe(8)
  })
})
