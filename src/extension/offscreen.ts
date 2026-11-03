// Offscreen document: a hidden StepCrumb page that does the recording.
// - The current tab, from a tabCapture stream ID (the keyboard shortcut).
// - Whatever was picked in Chrome's share dialog (a tab, a window or the screen).
//   The dialog is shown from here, so nothing visible has to stay open.
// - Puts a recording back together from its saved pieces if needed.
// Service workers can't use MediaRecorder, so the background asks this page to.
import { pauseRecording, recoverRecording, startRecording, stopRecording } from './recorder-core'

const ENDED = 'The shared screen stopped (Stop sharing was pressed, or the window closed).'
let display: MediaStream | null = null
let expectedEnd = false

async function startDisplay(videoId: string) {
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 } },
      audio: false,
      monitorTypeSurfaces: 'include',
      surfaceSwitching: 'include',
    } as DisplayMediaStreamOptions)
  } catch (err) {
    // NotAllowedError: they pressed Cancel (or the OS refused).
    if ((err as DOMException)?.name === 'NotAllowedError' && !/system|permission/i.test((err as Error).message)) return { cancelled: true }
    throw err
  }
  expectedEnd = false
  display = stream
  const info = await startRecording(
    stream,
    () => {
      display = null
      if (!expectedEnd) void chrome.runtime.sendMessage({ type: 'video-ended', reason: ENDED }).catch(() => {})
    },
    videoId,
  )
  void looksBlank(stream).then((blank) => blank && chrome.runtime.sendMessage({ type: 'video-blank' }).catch(() => {}))
  return info
}

// On a Mac without Screen Recording permission, a window or screen capture
// comes out blank. Sample a few tiny frames; if they're all one flat colour,
// tell the background, which shows the fix in the popup.
async function looksBlank(stream: MediaStream): Promise<boolean> {
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
      if (Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)) > 4) return false
    }
    return true
  } catch {
    return false
  } finally {
    v.srcObject = null
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.target !== 'offscreen') return
  if (msg.type === 'rec-pause' || msg.type === 'rec-resume') {
    pauseRecording(msg.type === 'rec-pause')
    reply({ ok: true })
    return
  }
  // Test hook: behave as if Chrome's "Stop sharing" was pressed.
  if (msg.type === 'rec-test-end') {
    display?.getVideoTracks()[0]?.dispatchEvent(new Event('ended'))
    reply({ ok: !!display })
    return
  }
  if (msg.type === 'rec-stop') expectedEnd = true
  const run =
    msg.type === 'rec-start-display'
      ? startDisplay(msg.videoId)
      : msg.type === 'rec-start'
        ? startRecording({
            // Chrome-specific constraints for tab capture.
            mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: msg.streamId, maxFrameRate: 30, minWidth: msg.w, maxWidth: msg.w, minHeight: msg.h, maxHeight: msg.h },
          } as MediaTrackConstraints)
        : msg.type === 'rec-stop'
          ? stopRecording(msg.videoId ?? null, msg.redact ?? []).finally(() => (display = null))
          : msg.type === 'rec-recover'
            ? recoverRecording(msg.videoId, msg.redact ?? [])
            : null
  if (!run) return
  run.then(reply, (err) => reply({ error: String(err?.message ?? err) }))
  return true
})
