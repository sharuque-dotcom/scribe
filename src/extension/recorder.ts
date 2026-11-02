// Small window that records a whole window or the entire screen.
// Chrome only shows its window/screen picker to a visible extension page,
// so this page asks for the source, records, and minimises itself.
import { pauseRecording, startRecording, stopRecording } from './recorder-core'

const params = new URLSearchParams(location.search)
const source = params.get('source') === 'window' ? 'window' : 'screen'
const status = document.getElementById('status')!
const send = (msg: object) => chrome.runtime.sendMessage(msg).catch(() => {})

function pick(): Promise<string> {
  return new Promise((resolve) => chrome.desktopCapture.chooseDesktopMedia([source], (id) => resolve(id || '')))
}

async function begin() {
  // Keep the background awake while the person chooses (it may otherwise sleep).
  const ping = window.setInterval(() => send({ type: 'desktop-ping' }), 10_000)
  window.addEventListener('pagehide', () => window.clearInterval(ping))
  status.textContent = source === 'window' ? 'Choose the window to record…' : 'Choose the screen to record…'
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
    status.textContent = 'Recording. You can keep working; finish from the StepCrumb button or Alt+Shift+R.'
    send({ type: 'desktop-ready', ...info })
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
