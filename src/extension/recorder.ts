// Small window that shows Chrome's share dialog (a tab, a window or the entire
// screen) and records what was picked. Chrome only shows that dialog to a
// visible extension page, so this page does the recording and minimises itself.
import { pickedSource } from '../shared/coords'
import type { RecordSource } from '../shared/types'
import { pauseRecording, startRecording, stopRecording } from './recorder-core'

const params = new URLSearchParams(location.search)
const asked = params.get('source')
const sources: string[] = asked === 'window' ? ['window'] : asked === 'screen' ? ['screen'] : ['tab', 'window', 'screen']

const status = document.getElementById('status')!
const send = (msg: object) => chrome.runtime.sendMessage(msg).catch(() => {})

function pick(): Promise<string> {
  return new Promise((resolve) => chrome.desktopCapture.chooseDesktopMedia(sources as unknown as chrome.desktopCapture.DesktopCaptureSourceType[], (id) => resolve(id || '')))
}

async function begin() {
  // Keep the background awake while the person chooses (it may otherwise sleep).
  const ping = window.setInterval(() => send({ type: 'desktop-ping' }), 10_000)
  window.addEventListener('pagehide', () => window.clearInterval(ping))
  status.textContent = 'Choose what to record…'
  const id = await pick()
  if (!id) {
    send({ type: 'desktop-ready', cancelled: true })
    return
  }
  try {
    const info = await startRecording(
      { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id, maxFrameRate: 30 } } as MediaTrackConstraints,
      // "Stop sharing" in Chrome's bar finishes the capture.
      () => send({ type: 'stop' }),
    )
    const source: RecordSource = sources.length === 1 ? (sources[0] as RecordSource) : pickedSource(info.surface, info.label)
    status.textContent = 'Recording. You can keep working; finish from the StepCrumb button or Alt+Shift+R.'
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
    status.textContent = 'Saving the recording…'
    stopRecording(msg.videoId ?? null).then(reply, (err) => reply({ error: String(err?.message ?? err) }))
    return true
  }
})

document.getElementById('stop')!.addEventListener('click', () => send({ type: 'stop' }))
void begin()
