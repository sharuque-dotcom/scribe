// The recording engine shared by the tab recorder (offscreen document) and the
// window/screen recorder (the recorder tab): MediaRecorder to WebM, then
// the file is indexed and saved to IndexedDB.
import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Output, WebMOutputFormat } from 'mediabunny'
import { deleteChunks, getChunks, putChunk, putVideo } from '../shared/db'
import { pixelateRects } from '../shared/redact'
import type { NRect, RedactSample } from '../shared/types'
import { redactAt } from '../shared/video/compose'

let recorder: MediaRecorder | null = null
let stream: MediaStream | null = null
let chunks: Blob[] = []
let mime = 'video/webm'
// Resolves once the recorder has stopped, however it stopped.
let stopped: Promise<unknown> = Promise.resolve()
let writes: Promise<unknown> = Promise.resolve()

// `persistAs`: also save each piece to IndexedDB as it arrives, so the video
// can be recovered (recoverRecording) if this page closes mid-recording.
export async function startRecording(video: MediaTrackConstraints | MediaStream, onEnded?: () => void, persistAs?: string) {
  stream = video instanceof MediaStream ? video : await navigator.mediaDevices.getUserMedia({ audio: false, video })
  // Fires if the user presses Chrome's "Stop sharing" button.
  stream.getVideoTracks()[0].addEventListener('ended', () => onEnded?.())
  mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'
  chunks = []
  writes = Promise.resolve()
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  recorder.ondataavailable = (e) => {
    if (!e.data.size) return
    chunks.push(e.data)
    if (persistAs) {
      const i = chunks.length
      writes = writes.then(() => putChunk(persistAs, i, e.data)).catch(() => {})
    }
  }
  const rec = recorder
  stopped = new Promise((r) => rec.addEventListener('stop', r, { once: true }))
  const started = new Promise<number>((r) => (recorder!.onstart = () => r(Date.now())))
  recorder.start(1000)
  const startedAt = await started
  const track = stream.getVideoTracks()[0]
  const s = track.getSettings() as MediaTrackSettings & { displaySurface?: string }
  return { startedAt, w: s.width ?? 0, h: s.height ?? 0, surface: s.displaySurface, label: track.label }
}

export function pauseRecording(pause: boolean) {
  if (pause && recorder?.state === 'recording') recorder.pause()
  if (!pause && recorder?.state === 'paused') recorder.resume()
}

// Secret-field positions active around time t (seconds). Neighbouring samples are
// included so a field that appears or moves between samples is still covered.
function secretsAt(t: number, samples: RedactSample[]): NRect[] {
  const ms = t * 1000
  return [...redactAt(ms - 400, samples), ...redactAt(ms, samples), ...redactAt(ms + 400, samples)]
}

export async function stopRecording(videoId: string | null, redact: RedactSample[] = []) {
  if (!recorder) return { duration: 0 }
  const rec = recorder
  // The recorder may already have stopped on its own (the shared window closed).
  if (rec.state !== 'inactive') rec.stop()
  await stopped
  stream?.getTracks().forEach((t) => t.stop())
  const raw = new Blob(chunks, { type: 'video/webm' })
  const persisted = writes
  recorder = null
  stream = null
  chunks = []
  if (!videoId) return { duration: 0 }
  // The pieces saved along the way aren't needed once the full file is saved.
  void persisted.then(() => deleteChunks(videoId)).catch(() => {})

  // MediaRecorder files have no index or duration, which makes seeking slow.
  // Copying them into a fresh WebM (no re-encoding) adds both. If secret fields
  // were on screen, frames are re-encoded with those areas pixelated, so the
  // saved file never holds them readable.
  const secret = redact.some((s) => s.rects.length > 0)
  // Re-encoding a long recording takes a while; keep the background awake meanwhile.
  const keepAlive = setInterval(() => chrome.runtime.sendMessage({ type: 'desktop-ping' }).catch(() => {}), 15_000)
  try {
    return await save(raw, videoId, redact, secret)
  } finally {
    clearInterval(keepAlive)
  }
}

// Puts a recording back together from the pieces saved while it was running,
// when the page that recorded it closed before finishing.
export async function recoverRecording(videoId: string, redact: RedactSample[] = []) {
  const parts = await getChunks(videoId)
  if (!parts.length) return { duration: 0 }
  mime = 'video/webm'
  try {
    return await save(new Blob(parts, { type: 'video/webm' }), videoId, redact, redact.some((s) => s.rects.length > 0))
  } finally {
    await deleteChunks(videoId).catch(() => {})
  }
}

async function save(raw: Blob, videoId: string, redact: RedactSample[], secret: boolean) {
  let blob: Blob = raw
  let duration = 0
  try {
    const input = new Input({ source: new BlobSource(raw), formats: ALL_FORMATS })
    const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() })
    let canvas: OffscreenCanvas | null = null
    const conversion = await Conversion.init({
      input,
      output,
      video: secret
        ? {
            forceTranscode: true,
            // This is the working copy that exports are made from, so keep it as sharp
            // as the original. (Quality presets guess a bitrate from the frame rate,
            // which is very low for mostly-still screen recordings.)
            bitrate: 8_000_000,
            process: (sample) => {
              const rects = secretsAt(sample.timestamp, redact)
              if (!rects.length) return sample
              canvas ??= new OffscreenCanvas(sample.displayWidth, sample.displayHeight)
              const ctx = canvas.getContext('2d')!
              sample.draw(ctx, 0, 0, canvas.width, canvas.height)
              pixelateRects(canvas, rects)
              return canvas
            },
          }
        : undefined,
    })
    await conversion.execute()
    blob = new Blob([(output.target as BufferTarget).buffer!], { type: 'video/webm' })
    const fixed = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
    duration = Math.round((await fixed.computeDuration()) * 1000)
  } catch (err) {
    // Never keep an unblurred copy: without a successful blur, the video is dropped.
    if (secret) {
      console.warn('Could not blur secret fields in the recording; the video was not saved.', err)
      return { duration: 0 }
    }
    console.warn('Could not index the recording; keeping the original file.', err)
  }
  await putVideo({ id: videoId, blob, mime })
  return { duration, size: blob.size }
}
