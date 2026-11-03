// Recorder tab: shows Chrome's share dialog (a tab, a window or the entire
// screen) over the person's browser and records what they pick. Chrome only
// shows that dialog to a visible extension page, so this tab does the
// recording; the background pins it and brings their tab back once it starts.
import { pickedSource } from '../shared/coords'
import type { RecordSource } from '../shared/types'
import { pauseRecording, startRecording, stopRecording } from './recorder-core'

const params = new URLSearchParams(location.search)
const asked = params.get('source')
const sources: string[] = asked === 'window' ? ['window'] : asked === 'screen' ? ['screen'] : ['tab', 'window', 'screen']

const status = document.getElementById('status')!
const hint = document.getElementById('hint')!
const isMac = /Mac/i.test(navigator.platform || navigator.userAgent)
if (isMac && !sources.every((x) => x === 'tab')) {
  hint.hidden = false
  hint.textContent = 'Recording a window or the entire screen on a Mac? Allow Chrome in System Settings → Privacy & Security → Screen Recording, then restart Chrome. Without it the video comes out blank.'
}

// This page's background colour (#0f1a2e). If most of a picked tab's frame is
// this colour, they picked this recorder tab itself.
const OWN = [15, 26, 46]
async function isThisTab(stream: MediaStream): Promise<boolean> {
  const v = document.createElement('video')
  v.muted = true
  v.srcObject = stream
  try {
    await v.play()
    await new Promise((r) => setTimeout(r, 300))
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 36
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let own = 0
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - OWN[0]) + Math.abs(d[i + 1] - OWN[1]) + Math.abs(d[i + 2] - OWN[2]) < 12) own++
    return own / (d.length / 4) > 0.6
  } catch {
    return false
  } finally {
    v.srcObject = null
  }
}
const send = (msg: object) => chrome.runtime.sendMessage(msg).catch(() => {})

function pick(): Promise<string> {
  return new Promise((resolve) => chrome.desktopCapture.chooseDesktopMedia(sources as unknown as chrome.desktopCapture.DesktopCaptureSourceType[], (id) => resolve(id || '')))
}

async function begin() {
  // Keep the background awake while the person chooses (it may otherwise sleep).
  const ping = window.setInterval(() => send({ type: 'desktop-ping' }), 10_000)
  window.addEventListener('pagehide', () => window.clearInterval(ping))
  status.textContent = 'Choose what to record…'
  let stream: MediaStream | null = null
  for (;;) {
    const id = await pick()
    if (!id) {
      send({ type: 'desktop-ready', cancelled: true })
      return
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id, maxFrameRate: 30 } } as MediaTrackConstraints,
      })
    } catch (err) {
      send({ type: 'desktop-ready', error: String((err as Error)?.message ?? err) })
      return
    }
    const surface = (stream.getVideoTracks()[0].getSettings() as { displaySurface?: string }).displaySurface
    const label = stream.getVideoTracks()[0].label
    if (pickedSource(surface, label) === 'tab' && (await isThisTab(stream))) {
      stream.getTracks().forEach((t) => t.stop())
      status.textContent = "That's StepCrumb's own tab. Pick the tab, window or screen you're working in."
      continue
    }
    break
  }
  try {
    const info = await startRecording(
      stream,
      // "Stop sharing" in Chrome's bar finishes the capture.
      () => send({ type: 'stop' }),
    )
    const source: RecordSource = sources.length === 1 ? (sources[0] as RecordSource) : pickedSource(info.surface, info.label)
    status.textContent = 'Recording. Keep this tab open. Finish from the StepCrumb button, Alt+Shift+R or here.'
    hint.hidden = true
    document.title = 'Recording · StepCrumb (keep open)'
    send({ type: 'desktop-ready', startedAt: info.startedAt, w: info.w, h: info.h, source })
  } catch (err) {
    send({ type: 'desktop-ready', error: String((err as Error)?.message ?? err) })
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.target !== 'recorder') return
  if (msg.type === 'rec-pause' || msg.type === 'rec-resume') {
    pauseRecording(msg.type === 'rec-pause')
    reply({ ok: true })
    return
  }
  if (msg.type === 'rec-stop') {
    status.textContent = 'Saving the recording (secret fields are blurred first)…'
    stopRecording(msg.videoId ?? null, msg.redact ?? []).then(reply, (err) => reply({ error: String(err?.message ?? err) }))
    return true
  }
})

document.getElementById('stop')!.addEventListener('click', () => send({ type: 'stop' }))
void begin()
