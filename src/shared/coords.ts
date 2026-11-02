// Converts positions on a web page into positions in the recorded video when
// the video is a whole window or the entire screen. All results are 0..1 of
// the video frame. Screen positions are in the browser's screen pixels (DIPs).
import type { NPoint, NRect, RecordSource } from './types'

export interface ScreenGeom {
  // Browser window, on screen.
  winX: number
  winY: number
  winW: number
  winH: number
  // The monitor the window is on.
  scrX: number
  scrY: number
  scrW: number
  scrH: number
}

// Chrome reports a monitor's position through availLeft/availTop, which on the
// main monitor can be a small taskbar/menu-bar inset rather than an offset.
// Only treat it as the monitor's position when it clearly is one.
export function monitorOffset(avail: number | undefined, size: number): number {
  if (!avail) return 0
  return avail < 0 || Math.abs(avail) >= size * 0.5 ? avail : 0
}

export function toVideoPoint(source: RecordSource, sx: number, sy: number, g: ScreenGeom): NPoint {
  if (source === 'window') return { x: (sx - g.winX) / g.winW, y: (sy - g.winY) / g.winH }
  return { x: (sx - g.scrX) / g.scrW, y: (sy - g.scrY) / g.scrH }
}

export function toVideoRect(source: RecordSource, left: number, top: number, right: number, bottom: number, g: ScreenGeom): NRect {
  const a = toVideoPoint(source, left, top, g)
  const b = toVideoPoint(source, right, bottom, g)
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
}

// Where the page's top-left corner is on screen, estimated from the window
// size when no mouse event has told us exactly.
export function estimateOrigin(g: ScreenGeom, innerW: number, innerH: number): NPoint {
  const side = Math.max(0, (g.winW - innerW) / 2)
  return { x: g.winX + side, y: g.winY + Math.max(0, g.winH - innerH - side) }
}
