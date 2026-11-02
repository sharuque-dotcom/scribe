// Offscreen document: records the captured tab.
// Service workers can't use MediaRecorder, so the background asks this page to.
import { pauseRecording, startRecording, stopRecording } from './recorder-core'

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.target !== 'offscreen') return
  if (msg.type === 'rec-pause' || msg.type === 'rec-resume') {
    pauseRecording(msg.type === 'rec-pause')
    reply({ ok: true })
    return
  }
  const run =
    msg.type === 'rec-start'
      ? startRecording({
          // Chrome-specific constraints for tab capture.
          mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: msg.streamId, maxFrameRate: 30, minWidth: msg.w, maxWidth: msg.w, minHeight: msg.h, maxHeight: msg.h },
        } as MediaTrackConstraints)
      : msg.type === 'rec-stop'
        ? stopRecording(msg.videoId ?? null)
        : null
  if (!run) return
  run.then(reply, (err) => reply({ error: String(err?.message ?? err) }))
  return true
})
