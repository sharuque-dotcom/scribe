// Offscreen document: records the captured tab to a WebM file.
// Service workers can't use MediaRecorder, so the background asks this page to.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WebMOutputFormat } from 'mediabunny'
import { putVideo } from '../shared/db'

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []
let mime = 'video/webm'

async function start(streamId: string, w: number, h: number) {
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      // Chrome-specific constraints for tab capture.
      mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId, maxFrameRate: 30, minWidth: w, maxWidth: w, minHeight: h, maxHeight: h },
    } as MediaTrackConstraints,
  })
  mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
  chunks = []
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const started = new Promise<number>((r) => (recorder!.onstart = () => r(Date.now())))
  recorder.start(1000)
  const startedAt = await started
  const s = stream.getVideoTracks()[0].getSettings()
  return { startedAt, w: s.width ?? 0, h: s.height ?? 0 }
}

async function stop(videoId: string | null) {
  if (!recorder) return { duration: 0 }
  const done = new Promise((r) => (recorder!.onstop = r))
  recorder.stop()
  await done
  stream?.getTracks().forEach((t) => t.stop())
  const raw = new Blob(chunks, { type: 'video/webm' })
  recorder = null
  stream = null
  chunks = []
  if (!videoId) return { duration: 0 }

  // MediaRecorder files have no index or duration, which makes seeking slow.
  // Copying them into a fresh WebM (no re-encoding) adds both.
  let blob: Blob = raw
  let duration = 0
  try {
    const input = new Input({ source: new BlobSource(raw), formats: ALL_FORMATS })
    const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() })
    const conversion = await Conversion.init({ input, output })
    await conversion.execute()
    blob = new Blob([(output.target as BufferTarget).buffer!], { type: 'video/webm' })
    const fixed = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
    duration = Math.round((await fixed.computeDuration()) * 1000)
  } catch (err) {
    console.warn('Could not index the recording; keeping the original file.', err)
  }
  await putVideo({ id: videoId, blob, mime })
  return { duration, size: blob.size }
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.target !== 'offscreen') return
  if (msg.type === 'rec-pause' || msg.type === 'rec-resume') {
    if (recorder?.state === 'recording' && msg.type === 'rec-pause') recorder.pause()
    if (recorder?.state === 'paused' && msg.type === 'rec-resume') recorder.resume()
    reply({ ok: true })
    return
  }
  const run = msg.type === 'rec-start' ? start(msg.streamId, msg.w, msg.h) : msg.type === 'rec-stop' ? stop(msg.videoId ?? null) : null
  if (!run) return
  run.then(reply, (err) => reply({ error: String(err?.message ?? err) }))
  return true
})
