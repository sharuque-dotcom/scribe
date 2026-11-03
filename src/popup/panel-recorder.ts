// Records what was picked in Chrome's share dialog (a tab, a window or the
// entire screen), right here in the side panel. The panel stays open beside the
// person's pages, so the recording never has to be moved or hidden. Each piece
// is also saved as it arrives, so closing the panel can't lose the video.
import { pickedSource } from '../shared/coords'
import type { PanelVideo } from '../shared/types'
import { uid } from '../shared/types'
import { pauseRecording, startRecording, stopRecording } from '../extension/recorder-core'

let live: MediaStream | null = null
let expectedEnd = false
const listeners = new Set<(s: MediaStream | null) => void>()
const setLive = (s: MediaStream | null) => {
  live = s
  listeners.forEach((f) => f(s))
}
export const liveStream = () => live
export function onLiveStream(f: (s: MediaStream | null) => void) {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

// Shows Chrome's share dialog. Must run from a click (Chrome needs a real gesture).
// Returns null if they cancelled.
export async function startPanelRecording(): Promise<PanelVideo | null> {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
      // Don't offer StepCrumb's own panel, and do offer whole screens.
      selfBrowserSurface: 'exclude',
      monitorTypeSurfaces: 'include',
      surfaceSwitching: 'include',
    } as DisplayMediaStreamOptions)
  } catch (err) {
    // NotAllowedError = they pressed Cancel.
    if ((err as DOMException)?.name === 'NotAllowedError') return null
    throw err
  }
  const id = uid()
  expectedEnd = false
  const info = await startRecording(
    stream,
    () => {
      setLive(null)
      // "Stop sharing" in Chrome's bar, the shared window closed, or capture failed.
      if (!expectedEnd) void chrome.runtime.sendMessage({ type: 'video-ended', reason: 'The shared screen stopped (Stop sharing was pressed, or the window closed).' }).catch(() => {})
    },
    id,
  )
  setLive(stream)
  return { id, startedAt: info.startedAt, w: info.w, h: info.h, source: pickedSource(info.surface, info.label) }
}

// Discards a recording that started but couldn't be used (e.g. the capture
// didn't start in the background).
export async function cancelPanelRecording() {
  expectedEnd = true
  await stopRecording(null)
  setLive(null)
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.target !== 'recorder') return
  if (msg.type === 'rec-alive') {
    // Only the panel that's recording answers.
    if (live) reply({ alive: true })
    return
  }
  if (!live && msg.type !== 'rec-stop') return
  if (msg.type === 'rec-pause' || msg.type === 'rec-resume') {
    pauseRecording(msg.type === 'rec-pause')
    reply({ ok: true })
    return
  }
  if (msg.type === 'rec-stop') {
    expectedEnd = true
    const wasLive = !!live
    setLive(null)
    if (!wasLive && !msg.videoId) return
    stopRecording(msg.videoId ?? null, msg.redact ?? []).then(reply, (err) => reply({ error: String(err?.message ?? err) }))
    return true
  }
})

// ---------- blank-capture check ----------
// On a Mac without Screen Recording permission, a window or screen capture
// comes out blank. Sample a few tiny frames; if they're all one flat colour,
// say so. (Wallpaper-only captures can't be told apart from a real desktop,
// which is why the panel also shows a live preview.)
export async function looksBlank(stream: MediaStream): Promise<boolean> {
  const v = document.createElement('video')
  v.muted = true
  v.srcObject = stream
  try {
    await v.play()
    const c = document.createElement('canvas')
    c.width = 48
    c.height = 27
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 700))
      if (!stream.active) return false
      ctx.drawImage(v, 0, 0, c.width, c.height)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let sum = 0
      let sq = 0
      const n = d.length / 4
      for (let j = 0; j < d.length; j += 4) {
        const l = 0.3 * d[j] + 0.59 * d[j + 1] + 0.11 * d[j + 2]
        sum += l
        sq += l * l
      }
      const sd = Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2))
      if (sd > 4) return false
    }
    return true
  } catch {
    return false
  } finally {
    v.srcObject = null
  }
}
